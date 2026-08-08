-- 1) Lock down anon/public execute on helper function
REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated, service_role;

-- 2) Hide correct_answer from students via column-level privileges
REVOKE SELECT ON public.assessment_questions FROM authenticated;
GRANT SELECT (id, assessment_id, position, kind, prompt, options, points, created_at, updated_at)
  ON public.assessment_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assessment_questions TO authenticated;
GRANT ALL ON public.assessment_questions TO service_role;

-- Owners (teachers) read full rows including answer keys through a checked function
CREATE OR REPLACE FUNCTION public.owner_assessment_questions(_assessment_id uuid)
RETURNS TABLE (
  id uuid, assessment_id uuid, "position" integer, kind text,
  prompt text, options jsonb, correct_answer text, points integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT q.id, q.assessment_id, q.position, q.kind, q.prompt, q.options, q.correct_answer, q.points
  FROM public.assessment_questions q
  WHERE q.assessment_id = _assessment_id
    AND (public.owns_assessment(auth.uid(), _assessment_id) OR public.has_role(auth.uid(), 'admin'))
  ORDER BY q.position;
$$;
REVOKE ALL ON FUNCTION public.owner_assessment_questions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_assessment_questions(uuid) TO authenticated, service_role;

-- Server-side grading so answers never reach the client
CREATE OR REPLACE FUNCTION public.submit_assessment(_submission_id uuid, _answers jsonb)
RETURNS TABLE (auto_score numeric, total_points integer, manual_pending boolean, passed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub public.assessment_submissions%ROWTYPE;
  _pass integer;
  _auto numeric := 0;
  _total integer := 0;
  _pending boolean := false;
  _passed boolean;
  _q record;
BEGIN
  SELECT * INTO _sub FROM public.assessment_submissions WHERE id = _submission_id;
  IF _sub.id IS NULL OR _sub.student_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT a.passing_score INTO _pass FROM public.assessments a WHERE a.id = _sub.assessment_id;

  FOR _q IN SELECT * FROM public.assessment_questions WHERE assessment_id = _sub.assessment_id LOOP
    _total := _total + _q.points;
    IF _q.kind = 'multiple_choice' THEN
      IF btrim(COALESCE(_answers ->> _q.id::text, '')) <> ''
         AND btrim(COALESCE(_answers ->> _q.id::text, '')) = btrim(COALESCE(_q.correct_answer, '')) THEN
        _auto := _auto + _q.points;
      END IF;
    ELSE
      _pending := true;
    END IF;
  END LOOP;

  _passed := CASE WHEN _pending THEN NULL
                  WHEN _total > 0 THEN (_auto / _total) * 100 >= COALESCE(_pass, 0)
                  ELSE false END;

  UPDATE public.assessment_submissions s
     SET answers = _answers,
         auto_score = _auto,
         total_points = _total,
         status = CASE WHEN _pending THEN 'submitted' ELSE 'graded' END,
         passed = _passed,
         submitted_at = now()
   WHERE s.id = _submission_id;

  RETURN QUERY SELECT _auto, _total, _pending, _passed;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_assessment(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) TO authenticated, service_role;

-- 3) Prevent students from changing their own grade/status/graded_at
CREATE OR REPLACE FUNCTION public.guard_submission_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _is_grader boolean;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (
           SELECT 1 FROM public.assignments a
           WHERE a.id = NEW.assignment_id
             AND public.teaches_class(auth.uid(), a.class_id))
    INTO _is_grader;

  IF NOT COALESCE(_is_grader, false) THEN
    NEW.grade := OLD.grade;
    NEW.graded_at := OLD.graded_at;
    NEW.status := OLD.status;
    NEW.student_id := OLD.student_id;
    NEW.assignment_id := OLD.assignment_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_submission_grade() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS submissions_grade_guard ON public.submissions;
CREATE TRIGGER submissions_grade_guard
BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_submission_grade();

DROP POLICY IF EXISTS "update submissions" ON public.submissions;
CREATE POLICY "update submissions" ON public.submissions
FOR UPDATE TO authenticated
USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = submissions.assignment_id AND public.teaches_class(auth.uid(), a.class_id))
)
WITH CHECK (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = submissions.assignment_id AND public.teaches_class(auth.uid(), a.class_id))
);