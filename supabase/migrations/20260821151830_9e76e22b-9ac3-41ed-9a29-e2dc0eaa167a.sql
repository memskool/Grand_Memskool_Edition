ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

UPDATE public.classes c
   SET school_id = public.my_school_id(c.teacher_id)
 WHERE c.school_id IS NULL AND c.teacher_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.owns_class_school(_user uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.schools s ON s.id = c.school_id
    WHERE c.id = _class_id AND s.owner_id = _user
  );
$$;

REVOKE EXECUTE ON FUNCTION public.owns_class_school(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_class_school(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "school owners manage classes" ON public.classes;
CREATE POLICY "school owners manage classes" ON public.classes
FOR ALL TO authenticated
USING (school_id IS NOT NULL AND public.owns_school(auth.uid(), school_id))
WITH CHECK (school_id IS NOT NULL AND public.owns_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "school owners manage timetable" ON public.timetable_slots;
CREATE POLICY "school owners manage timetable" ON public.timetable_slots
FOR ALL TO authenticated
USING (public.owns_class_school(auth.uid(), class_id))
WITH CHECK (public.owns_class_school(auth.uid(), class_id));

DROP POLICY IF EXISTS "school owners manage enrollments" ON public.class_enrollments;
CREATE POLICY "school owners manage enrollments" ON public.class_enrollments
FOR ALL TO authenticated
USING (public.owns_class_school(auth.uid(), class_id))
WITH CHECK (public.owns_class_school(auth.uid(), class_id));

DROP POLICY IF EXISTS "teachers manage enrollments" ON public.class_enrollments;
CREATE POLICY "teachers manage enrollments" ON public.class_enrollments
FOR ALL TO authenticated
USING (public.teaches_class(auth.uid(), class_id))
WITH CHECK (public.teaches_class(auth.uid(), class_id));