CREATE OR REPLACE FUNCTION public.normalize_school_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.code := upper(regexp_replace(coalesce(NEW.code,''), '\s+', '', 'g'));
  IF NEW.code !~ '^[A-Z0-9-]{3,24}$' THEN
    RAISE EXCEPTION 'School ID must be 3-24 characters using letters, numbers or dashes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_normalize_code ON public.schools;
CREATE TRIGGER schools_normalize_code
BEFORE INSERT OR UPDATE OF code ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.normalize_school_code();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role public.app_role;
  _school_code text := nullif(trim(NEW.raw_user_meta_data->>'school_code'),'');
  _student_code text := nullif(trim(NEW.raw_user_meta_data->>'student_code'),'');
  _school_name text := nullif(trim(NEW.raw_user_meta_data->>'school_name'),'');
  _school_id uuid;
  _new_code text;
BEGIN
  BEGIN
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');
  EXCEPTION WHEN others THEN
    _role := 'student';
  END;

  IF _school_code IS NOT NULL THEN
    SELECT s.id INTO _school_id FROM public.schools s WHERE upper(s.code) = upper(_school_code) LIMIT 1;
  END IF;

  IF _role = 'institution' THEN
    _new_code := upper(regexp_replace(COALESCE(_school_code, ''), '\s+', '', 'g'));
    IF _new_code !~ '^[A-Z0-9-]{3,24}$'
       OR EXISTS (SELECT 1 FROM public.schools s WHERE upper(s.code) = _new_code) THEN
      _new_code := 'MS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    END IF;
    INSERT INTO public.schools (name, code, owner_id, created_by, contact_email)
    VALUES (COALESCE(_school_name, NEW.raw_user_meta_data->>'full_name', 'New School'), _new_code, NEW.id, NEW.id, NEW.email)
    RETURNING id INTO _school_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, school_id, student_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', _school_name, ''), NEW.email, _school_id, _student_code)
  ON CONFLICT (id) DO UPDATE SET school_id = COALESCE(EXCLUDED.school_id, public.profiles.school_id);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _school_id IS NOT NULL AND _role <> 'institution' THEN
    INSERT INTO public.school_members (school_id, user_id, role, status, student_code)
    VALUES (_school_id, NEW.id, _role, CASE WHEN _role = 'teacher' THEN 'pending' ELSE 'approved' END, _student_code)
    ON CONFLICT (school_id, user_id) DO NOTHING;

    UPDATE public.school_roster r SET claimed_by = NEW.id
    WHERE r.school_id = _school_id AND r.claimed_by IS NULL
      AND ((_student_code IS NOT NULL AND upper(r.student_code) = upper(_student_code))
        OR (r.email IS NOT NULL AND lower(r.email) = lower(NEW.email)));
  END IF;

  RETURN NEW;
END;
$$;