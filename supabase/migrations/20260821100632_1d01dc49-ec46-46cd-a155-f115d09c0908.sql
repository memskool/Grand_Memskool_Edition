REVOKE EXECUTE ON FUNCTION public.lookup_school(text) FROM anon, PUBLIC;

DROP POLICY IF EXISTS "users request membership" ON public.school_members;
CREATE POLICY "users request membership"
ON public.school_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.owns_school(auth.uid(), school_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    user_id = auth.uid()
    AND status = 'pending'
    AND role IN ('student', 'parent', 'teacher')
  )
);