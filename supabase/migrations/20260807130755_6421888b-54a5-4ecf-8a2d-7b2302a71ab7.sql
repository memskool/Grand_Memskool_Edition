-- ============ LOCKER FOLDERS ============
CREATE TABLE public.locker_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locker_folders TO authenticated;
GRANT ALL ON public.locker_folders TO service_role;
ALTER TABLE public.locker_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own locker folders" ON public.locker_folders FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ============ LOCKER ITEMS EXTENSIONS ============
ALTER TABLE public.locker_items
  ADD COLUMN folder_id uuid REFERENCES public.locker_folders(id) ON DELETE SET NULL,
  ADD COLUMN class_level text,
  ADD COLUMN category text NOT NULL DEFAULT 'note',
  ADD COLUMN file_path text,
  ADD COLUMN file_name text,
  ADD COLUMN file_size bigint,
  ADD COLUMN mime_type text,
  ADD COLUMN from_missed_work boolean NOT NULL DEFAULT false,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- ============ LIBRARY BOOKS ============
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  description text,
  category text NOT NULL DEFAULT 'course_material',
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_level text,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read library" ON public.library_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage library" ON public.library_books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin') OR uploaded_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin') OR uploaded_by = auth.uid());

-- ============ LESSON RESOURCES ============
CREATE TABLE public.lesson_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  lesson_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'note',
  url text,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_resources TO authenticated;
GRANT ALL ON public.lesson_resources TO service_role;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read lesson resources" ON public.lesson_resources FOR SELECT TO authenticated
  USING (public.is_enrolled(auth.uid(), class_id) OR public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "teachers manage lesson resources" ON public.lesson_resources FOR ALL TO authenticated
  USING (public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'));

-- ============ MISSED WORK ============
CREATE TABLE public.missed_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES public.lesson_resources(id) ON DELETE CASCADE,
  lesson_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'note',
  url text,
  file_path text,
  file_name text,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  released_to_locker boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, resource_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missed_work TO authenticated;
GRANT ALL ON public.missed_work TO service_role;
ALTER TABLE public.missed_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read missed work" ON public.missed_work FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_parent_of(auth.uid(), student_id)
         OR public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "students update own missed work" ON public.missed_work FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "staff manage missed work" ON public.missed_work FOR ALL TO authenticated
  USING (public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'));

-- Enforce: cannot release to locker before reviewed
CREATE OR REPLACE FUNCTION public.enforce_missed_work_release()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reviewed AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at := now();
  END IF;
  IF NEW.released_to_locker AND NOT NEW.reviewed THEN
    RAISE EXCEPTION 'Missed work must be marked as reviewed before it can be moved to the locker';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER missed_work_release_guard BEFORE INSERT OR UPDATE ON public.missed_work
  FOR EACH ROW EXECUTE FUNCTION public.enforce_missed_work_release();

-- Auto-route lesson resources to missed work when a student is absent
CREATE OR REPLACE FUNCTION public.route_absence_to_missed_work()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.status) <> 'absent' OR NEW.class_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.missed_work (student_id, class_id, resource_id, lesson_date, title, category, url, file_path, file_name)
  SELECT NEW.student_id, r.class_id, r.id, r.lesson_date, r.title, r.category, r.url, r.file_path, r.file_name
  FROM public.lesson_resources r
  WHERE r.class_id = NEW.class_id AND r.lesson_date = NEW.date
  ON CONFLICT (student_id, resource_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_absence_missed_work AFTER INSERT OR UPDATE OF status ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.route_absence_to_missed_work();

-- New resources added for a lesson also reach already-absent students
CREATE OR REPLACE FUNCTION public.route_resource_to_absentees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.missed_work (student_id, class_id, resource_id, lesson_date, title, category, url, file_path, file_name)
  SELECT a.student_id, NEW.class_id, NEW.id, NEW.lesson_date, NEW.title, NEW.category, NEW.url, NEW.file_path, NEW.file_name
  FROM public.attendance a
  WHERE a.class_id = NEW.class_id AND a.date = NEW.lesson_date AND lower(a.status) = 'absent'
  ON CONFLICT (student_id, resource_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER lesson_resource_absentees AFTER INSERT ON public.lesson_resources
  FOR EACH ROW EXECUTE FUNCTION public.route_resource_to_absentees();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER locker_folders_updated_at BEFORE UPDATE ON public.locker_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER locker_items_updated_at BEFORE UPDATE ON public.locker_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER library_books_updated_at BEFORE UPDATE ON public.library_books FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();