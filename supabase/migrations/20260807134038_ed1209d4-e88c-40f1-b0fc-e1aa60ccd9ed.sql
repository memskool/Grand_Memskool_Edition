-- Assessments engine
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_limit_minutes integer NOT NULL DEFAULT 30,
  passing_score integer NOT NULL DEFAULT 50,
  total_points integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own assessments" ON public.assessments
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Enrolled students read published assessments" ON public.assessments
  FOR SELECT TO authenticated
  USING (published AND class_id IS NOT NULL AND public.is_enrolled(auth.uid(), class_id));

CREATE TRIGGER assessments_updated_at BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Questions
CREATE TABLE public.assessment_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'multiple_choice',
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  points integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_questions_kind_check CHECK (kind IN ('multiple_choice','short_answer'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_questions TO authenticated;
GRANT ALL ON public.assessment_questions TO service_role;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_assessment(_user_id uuid, _assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = _assessment_id AND a.created_by = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.owns_assessment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_assessment(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_take_assessment(_user_id uuid, _assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = _assessment_id AND a.published
      AND a.class_id IS NOT NULL
      AND public.is_enrolled(_user_id, a.class_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_take_assessment(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_take_assessment(uuid, uuid) TO authenticated;

CREATE POLICY "Owners manage questions" ON public.assessment_questions
  FOR ALL TO authenticated
  USING (public.owns_assessment(auth.uid(), assessment_id))
  WITH CHECK (public.owns_assessment(auth.uid(), assessment_id));

CREATE POLICY "Students read questions of available assessments" ON public.assessment_questions
  FOR SELECT TO authenticated
  USING (public.can_take_assessment(auth.uid(), assessment_id));

CREATE TRIGGER assessment_questions_updated_at BEFORE UPDATE ON public.assessment_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attempts / submissions
CREATE TABLE public.assessment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_score numeric NOT NULL DEFAULT 0,
  manual_score numeric,
  total_points integer NOT NULL DEFAULT 0,
  passed boolean,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id),
  CONSTRAINT assessment_submissions_status_check CHECK (status IN ('in_progress','submitted','graded'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_submissions TO authenticated;
GRANT ALL ON public.assessment_submissions TO service_role;
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own attempts" ON public.assessment_submissions
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid() AND public.can_take_assessment(auth.uid(), assessment_id));

CREATE POLICY "Assessment owners read and grade attempts" ON public.assessment_submissions
  FOR SELECT TO authenticated
  USING (public.owns_assessment(auth.uid(), assessment_id));

CREATE POLICY "Assessment owners update attempts" ON public.assessment_submissions
  FOR UPDATE TO authenticated
  USING (public.owns_assessment(auth.uid(), assessment_id))
  WITH CHECK (public.owns_assessment(auth.uid(), assessment_id));

CREATE POLICY "Parents read their children attempts" ON public.assessment_submissions
  FOR SELECT TO authenticated
  USING (public.is_parent_of(auth.uid(), student_id));

CREATE TRIGGER assessment_submissions_updated_at BEFORE UPDATE ON public.assessment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_assessment_questions_assessment ON public.assessment_questions(assessment_id, position);
CREATE INDEX idx_assessment_submissions_student ON public.assessment_submissions(student_id);