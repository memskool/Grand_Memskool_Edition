ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_student_profile_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.parent_students
  ADD CONSTRAINT parent_students_student_profile_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.parent_students
  ADD CONSTRAINT parent_students_parent_profile_fkey
  FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.class_enrollments
  ADD CONSTRAINT class_enrollments_student_profile_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_teacher_profile_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_profile_fkey
  FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.teaches_class(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_enrolled(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) FROM anon;