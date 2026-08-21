CREATE OR REPLACE FUNCTION public.notify_class_session_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _class text; _host text;
BEGIN
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  SELECT c.name INTO _class FROM public.classes c WHERE c.id = NEW.class_id;
  SELECT p.full_name INTO _host FROM public.profiles p WHERE p.id = NEW.host_id;

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  SELECT e.student_id,
         'Live lesson started',
         COALESCE(_host, 'Your teacher') || ' just started a live lesson for ' || COALESCE(_class, 'your class') || '. Join now.',
         'announcement', '/virtual-classroom'
  FROM public.class_enrollments e
  WHERE e.class_id = NEW.class_id AND e.student_id <> NEW.host_id;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS classroom_session_started_notify ON public.classroom_sessions;
CREATE TRIGGER classroom_session_started_notify
AFTER INSERT ON public.classroom_sessions
FOR EACH ROW EXECUTE FUNCTION public.notify_class_session_started();

-- Only approved teachers may create classroom sessions / act as staff on their classes
CREATE OR REPLACE FUNCTION public.is_approved_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.schools s WHERE s.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.school_members m WHERE m.user_id = _user_id AND m.status = 'approved');
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_member(uuid) TO authenticated, service_role;