REVOKE ALL ON public.assessment_questions FROM anon;
GRANT SELECT (id, assessment_id, "position", kind, prompt, options, points, created_at, updated_at)
  ON public.assessment_questions TO authenticated;