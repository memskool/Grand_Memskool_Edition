
ALTER TABLE public.school_members
  ADD CONSTRAINT school_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.can_view_member_profile(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members m
    JOIN public.schools s ON s.id = m.school_id
    WHERE m.user_id = _target AND s.owner_id = _viewer
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_member_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_member_profile(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_parent_of(auth.uid(), id)
  OR public.can_view_member_profile(auth.uid(), id)
);

CREATE OR REPLACE FUNCTION public.remind_school(_school_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _me uuid := auth.uid(); _name text; _role app_role; _school text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT s.owner_id, s.name INTO _owner, _school FROM public.schools s WHERE s.id = _school_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'School not found'; END IF;

  SELECT p.full_name INTO _name FROM public.profiles p WHERE p.id = _me;
  SELECT r.role INTO _role FROM public.user_roles r WHERE r.user_id = _me LIMIT 1;

  INSERT INTO public.school_members (school_id, user_id, role, status)
  VALUES (_school_id, _me, COALESCE(_role, 'teacher'), 'pending')
  ON CONFLICT (school_id, user_id) DO UPDATE
    SET status = CASE WHEN public.school_members.status = 'approved' THEN 'approved' ELSE 'pending' END,
        updated_at = now();

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (_owner, 'Approval reminder',
          COALESCE(_name, 'A member') || ' is waiting for approval to join ' || COALESCE(_school, 'your school') || '.',
          'announcement', '/dashboard');
END;
$$;
REVOKE ALL ON FUNCTION public.remind_school(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remind_school(uuid) TO authenticated;
