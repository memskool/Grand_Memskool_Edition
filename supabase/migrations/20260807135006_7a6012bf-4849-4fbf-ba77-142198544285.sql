-- SCHOOLS
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'secondary',
  country text NOT NULL DEFAULT 'Uganda',
  city text,
  description text,
  website text,
  logo_url text,
  fees_min numeric,
  fees_max numeric,
  fees_currency text NOT NULL DEFAULT 'UGX',
  fees_notes text,
  badges text[] NOT NULL DEFAULT '{}',
  is_international boolean NOT NULL DEFAULT false,
  admissions_open boolean NOT NULL DEFAULT true,
  contact_email text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can browse schools" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert schools" ON public.schools FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND created_by = auth.uid());
CREATE POLICY "Admins update own schools" ON public.schools FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') AND (created_by = auth.uid() OR created_by IS NULL)) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete own schools" ON public.schools FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') AND created_by = auth.uid());
CREATE TRIGGER schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- APPLICATIONS
CREATE TABLE public.school_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  applicant_name text NOT NULL,
  email text,
  phone text,
  class_level text,
  intended_program text,
  personal_statement text,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_applications TO authenticated;
GRANT ALL ON public.school_applications TO service_role;
ALTER TABLE public.school_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own applications" ON public.school_applications FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Parents view child applications" ON public.school_applications FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), student_id));
CREATE POLICY "Admins view applications" ON public.school_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins review applications" ON public.school_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER school_applications_updated_at BEFORE UPDATE ON public.school_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'general',
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _school text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT name INTO _school FROM public.schools WHERE id = NEW.school_id;
    NEW.reviewed_at := now();
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    VALUES (NEW.student_id,
            'Application ' || NEW.status,
            COALESCE(_school,'A school') || ' updated your admission application status to ' || NEW.status || '.',
            'application', '/dream-school');
    INSERT INTO public.notifications (user_id, title, body, kind, link)
    SELECT p.parent_id,
           'Application ' || NEW.status,
           COALESCE(_school,'A school') || ' updated an application status to ' || NEW.status || '.',
           'application', '/dream-school'
    FROM public.parent_students p WHERE p.student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_application_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER school_application_status_notify BEFORE UPDATE ON public.school_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_status();

-- STUDY REMINDERS
CREATE TABLE public.study_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time,
  remind_minutes_before integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_reminders TO authenticated;
GRANT ALL ON public.study_reminders TO service_role;
ALTER TABLE public.study_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own study reminders" ON public.study_reminders FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER study_reminders_updated_at BEFORE UPDATE ON public.study_reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MEETINGS
CREATE TABLE public.school_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'pta',
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  location text,
  meeting_url text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_meetings TO authenticated;
GRANT ALL ON public.school_meetings TO service_role;
ALTER TABLE public.school_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view meetings" ON public.school_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create meetings" ON public.school_meetings FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')) AND created_by = auth.uid());
CREATE POLICY "Staff update meetings" ON public.school_meetings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR created_by = auth.uid());
CREATE POLICY "Staff delete meetings" ON public.school_meetings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR created_by = auth.uid());
CREATE TRIGGER school_meetings_updated_at BEFORE UPDATE ON public.school_meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ADMIN TIMETABLE MANAGEMENT
CREATE POLICY "Admins manage timetable slots" ON public.timetable_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));