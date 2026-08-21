CREATE OR REPLACE FUNCTION public.guard_missed_work_student_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _is_staff boolean;
BEGIN
  _is_staff := public.has_role(auth.uid(), 'admin')
            OR public.teaches_class(auth.uid(), OLD.class_id);

  IF NOT COALESCE(_is_staff, false) THEN
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
    -- review / release state is staff-controlled only
    NEW.reviewed := OLD.reviewed;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.released_to_locker := OLD.released_to_locker;
  END IF;
  RETURN NEW;
END;
$function$;