
-- 1. Assessment submissions: block students from writing grading fields
CREATE OR REPLACE FUNCTION public.guard_assessment_submission_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _is_grader boolean;
BEGIN
  IF COALESCE(current_setting('memskool.grading', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  _is_grader := public.has_role(auth.uid(), 'admin')
             OR public.owns_assessment(auth.uid(), OLD.assessment_id);

  IF NOT COALESCE(_is_grader, false) THEN
    NEW.auto_score := OLD.auto_score;
    NEW.manual_score := OLD.manual_score;
    NEW.total_points := OLD.total_points;
    NEW.passed := OLD.passed;
    NEW.status := OLD.status;
    NEW.submitted_at := OLD.submitted_at;
    NEW.student_id := OLD.student_id;
    NEW.assessment_id := OLD.assessment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_assessment_submission_grade ON public.assessment_submissions;
CREATE TRIGGER guard_assessment_submission_grade
BEFORE UPDATE ON public.assessment_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_submission_grade();

-- allow the official submit path to write scores
CREATE OR REPLACE FUNCTION public.submit_assessment(_submission_id uuid, _answers jsonb)
 RETURNS TABLE(auto_score numeric, total_points integer, manual_pending boolean, passed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF _sub.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This attempt has already been submitted';
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

  PERFORM set_config('memskool.grading', 'on', true);

  UPDATE public.assessment_submissions s
     SET answers = _answers,
         auto_score = _auto,
         total_points = _total,
         status = CASE WHEN _pending THEN 'submitted' ELSE 'graded' END,
         passed = _passed,
         submitted_at = now()
   WHERE s.id = _submission_id;

  PERFORM set_config('memskool.grading', 'off', true);

  RETURN QUERY SELECT _auto, _total, _pending, _passed;
END;
$function$;

-- 2. conversation_members: only self-add or the conversation creator can add
DROP POLICY IF EXISTS "Members can be added by participants" ON public.conversation_members;
CREATE POLICY "Members can be added by self or creator"
ON public.conversation_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_members.conversation_id
      AND c.created_by = auth.uid()
  )
);

-- 3. missed_work: students may only progress review/release, nothing else
CREATE OR REPLACE FUNCTION public.guard_missed_work_student_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _is_staff boolean;
BEGIN
  _is_staff := public.has_role(auth.uid(), 'admin')
            OR public.teaches_class(auth.uid(), OLD.class_id);

  IF NOT COALESCE(_is_staff, false) THEN
    -- immutable content fields
    NEW.student_id := OLD.student_id;
    NEW.class_id := OLD.class_id;
    NEW.resource_id := OLD.resource_id;
    NEW.lesson_date := OLD.lesson_date;
    NEW.title := OLD.title;
    NEW.category := OLD.category;
    NEW.url := OLD.url;
    NEW.file_path := OLD.file_path;
    NEW.file_name := OLD.file_name;
    NEW.created_at := OLD.created_at;
    -- review/release may only move forward
    NEW.reviewed := OLD.reviewed OR NEW.reviewed;
    NEW.released_to_locker := OLD.released_to_locker OR NEW.released_to_locker;
    IF NEW.reviewed AND OLD.reviewed THEN
      NEW.reviewed_at := OLD.reviewed_at;
    END IF;
    IF NOT NEW.reviewed THEN
      NEW.reviewed_at := OLD.reviewed_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_missed_work_student_update ON public.missed_work;
CREATE TRIGGER guard_missed_work_student_update
BEFORE UPDATE ON public.missed_work
FOR EACH ROW EXECUTE FUNCTION public.guard_missed_work_student_update();

REVOKE EXECUTE ON FUNCTION public.guard_assessment_submission_grade() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_missed_work_student_update() FROM PUBLIC, anon, authenticated;
