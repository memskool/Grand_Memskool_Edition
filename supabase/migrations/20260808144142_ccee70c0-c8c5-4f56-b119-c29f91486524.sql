-- 1. phone on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2. preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own prefs" ON public.notification_preferences;
CREATE POLICY "own prefs" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. deliveries
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  provider_message_id text,
  error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel)
);
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own deliveries" ON public.notification_deliveries;
CREATE POLICY "own deliveries" ON public.notification_deliveries FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER notification_deliveries_updated_at BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS notification_deliveries_pending_idx
  ON public.notification_deliveries (status, next_attempt_at);

-- 4. fan-out trigger
CREATE OR REPLACE FUNCTION public.fanout_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _email text; _phone text; _email_on boolean := true; _sms_on boolean := true;
  _email_kinds text[] := ARRAY['application','discipline','payment','assessment','meeting','announcement','security','order'];
  _sms_kinds text[]   := ARRAY['application','discipline','meeting','payment','announcement','security'];
BEGIN
  SELECT p.email, p.phone INTO _email, _phone FROM public.profiles p WHERE p.id = NEW.user_id;
  SELECT np.email_enabled, np.sms_enabled INTO _email_on, _sms_on
    FROM public.notification_preferences np WHERE np.user_id = NEW.user_id;
  _email_on := COALESCE(_email_on, true);
  _sms_on := COALESCE(_sms_on, true);

  IF _email_on AND _email IS NOT NULL AND _email <> '' AND NEW.kind = ANY(_email_kinds) THEN
    INSERT INTO public.notification_deliveries (notification_id, user_id, channel, destination)
    VALUES (NEW.id, NEW.user_id, 'email', _email)
    ON CONFLICT (notification_id, channel) DO NOTHING;
  END IF;

  IF _sms_on AND _phone IS NOT NULL AND _phone <> '' AND NEW.kind = ANY(_sms_kinds) THEN
    INSERT INTO public.notification_deliveries (notification_id, user_id, channel, destination)
    VALUES (NEW.id, NEW.user_id, 'sms', _phone)
    ON CONFLICT (notification_id, channel) DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.fanout_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notifications_fanout ON public.notifications;
CREATE TRIGGER notifications_fanout AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fanout_notification();

-- 5. assessment submitted / graded notifications
CREATE OR REPLACE FUNCTION public.notify_assessment_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _title text; _owner uuid;
BEGIN
  SELECT a.title, a.created_by INTO _title, _owner FROM public.assessments a WHERE a.id = NEW.assessment_id;

  IF NEW.status IN ('submitted','graded') AND COALESCE(OLD.status,'') NOT IN ('submitted','graded') THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.student_id, 'Assessment submitted',
            'Your submission for ' || COALESCE(_title,'an assessment') || ' was received.', 'assessment', '/assessments');
    IF _owner IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, kind, link)
      VALUES (_owner, 'New submission to review',
              'A learner submitted ' || COALESCE(_title,'an assessment') || '.', 'assessment', '/assessments');
    END IF;
  END IF;

  IF NEW.manual_score IS DISTINCT FROM OLD.manual_score AND NEW.manual_score IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.student_id, 'Assessment graded',
            COALESCE(_title,'Your assessment') || ' has been graded: ' || NEW.manual_score || '/' || NEW.total_points || '.',
            'assessment', '/assessments');
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    SELECT ps.parent_id, 'Assessment graded',
           COALESCE(_title,'An assessment') || ' was graded: ' || NEW.manual_score || '/' || NEW.total_points || '.',
           'assessment', '/dashboard'
    FROM public.parent_students ps WHERE ps.student_id = NEW.student_id;
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_assessment_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assessment_submission_notify ON public.assessment_submissions;
CREATE TRIGGER assessment_submission_notify AFTER UPDATE ON public.assessment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_assessment_events();

-- 6. meeting notifications
CREATE OR REPLACE FUNCTION public.notify_school_meeting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.class_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  SELECT e.student_id, NEW.title,
         'Scheduled for ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.'
         || COALESCE(' ' || NEW.location, ''),
         'meeting', '/timetable'
  FROM public.class_enrollments e WHERE e.class_id = NEW.class_id;

  INSERT INTO public.notifications (user_id, title, body, kind, link)
  SELECT DISTINCT ps.parent_id, NEW.title,
         'Scheduled for ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.'
         || COALESCE(' ' || NEW.location, ''),
         'meeting', '/timetable'
  FROM public.class_enrollments e
  JOIN public.parent_students ps ON ps.student_id = e.student_id
  WHERE e.class_id = NEW.class_id;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.notify_school_meeting() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS school_meeting_notify ON public.school_meetings;
CREATE TRIGGER school_meeting_notify AFTER INSERT ON public.school_meetings
  FOR EACH ROW EXECUTE FUNCTION public.notify_school_meeting();