-- ============ SCHOOL IDENTITY ============
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.schools SET code = 'MS-' || upper(substr(replace(id::text,'-',''),1,6)) WHERE code IS NULL;
ALTER TABLE public.schools ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS schools_code_unique ON public.schools (upper(code));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS student_code text;

-- ============ MEMBERSHIP ============
CREATE TABLE IF NOT EXISTS public.school_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  status text NOT NULL DEFAULT 'pending',
  student_code text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_members TO authenticated;
GRANT ALL ON public.school_members TO service_role;
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_school(_user uuid, _school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = _school AND s.owner_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.my_school_id(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT s.id FROM public.schools s WHERE s.owner_id = _user LIMIT 1),
    (SELECT m.school_id FROM public.school_members m WHERE m.user_id = _user AND m.status = 'approved' LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_school(_user uuid, _school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.my_school_id(_user) = _school;
$$;

REVOKE ALL ON FUNCTION public.owns_school(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_school_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_school(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_school(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_school_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_school(uuid,uuid) TO authenticated, service_role;

CREATE POLICY "members read own membership" ON public.school_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_school(auth.uid(), school_id) OR public.shares_school(auth.uid(), school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users request membership" ON public.school_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.owns_school(auth.uid(), school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "school owners manage membership" ON public.school_members FOR UPDATE TO authenticated
  USING (public.owns_school(auth.uid(), school_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.owns_school(auth.uid(), school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "school owners remove membership" ON public.school_members FOR DELETE TO authenticated
  USING (public.owns_school(auth.uid(), school_id) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER school_members_updated_at BEFORE UPDATE ON public.school_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ROSTER (school-uploaded people) ============
CREATE TABLE IF NOT EXISTS public.school_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'student',
  student_code text,
  email text,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_roster TO authenticated;
GRANT ALL ON public.school_roster TO service_role;
ALTER TABLE public.school_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school owners manage roster" ON public.school_roster FOR ALL TO authenticated
  USING (public.owns_school(auth.uid(), school_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.owns_school(auth.uid(), school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "members read own roster row" ON public.school_roster FOR SELECT TO authenticated
  USING (claimed_by = auth.uid());

-- ============ SIGNUP LOOKUP (public) ============
CREATE OR REPLACE FUNCTION public.lookup_school(_code text)
RETURNS TABLE (id uuid, name text, city text, country text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.city, s.country
  FROM public.schools s
  WHERE upper(s.code) = upper(trim(_code))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.lookup_school(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_school(text) TO anon, authenticated, service_role;

-- ============ SIGNUP TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    _new_code := 'MS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
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

-- Keep school owners able to update their own school record
DROP POLICY IF EXISTS "Admins update own schools" ON public.schools;
CREATE POLICY "Owners and admins update schools" ON public.schools FOR UPDATE TO authenticated
  USING (public.owns_school(auth.uid(), id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.owns_school(auth.uid(), id) OR public.has_role(auth.uid(),'admin'));

-- ============ PLATFORM ADMIN ACCOUNT ============
DO $$
DECLARE _id uuid;
BEGIN
  SELECT u.id INTO _id FROM auth.users u WHERE lower(u.email) = 'admin@memskool.com';
  IF _id IS NULL THEN
    _id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _id, 'authenticated', 'authenticated',
      'admin@memskool.com',
      extensions.crypt('Memskooladministrator2026', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Memskool Administrator","role":"admin"}'::jsonb,
      now(), now()
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _id, _id::text,
      jsonb_build_object('sub', _id::text, 'email', 'admin@memskool.com', 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users
      SET encrypted_password = extensions.crypt('Memskooladministrator2026', extensions.gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now())
      WHERE id = _id;
  END IF;
  INSERT INTO public.profiles (id, full_name, email) VALUES (_id, 'Memskool Administrator', 'admin@memskool.com')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;