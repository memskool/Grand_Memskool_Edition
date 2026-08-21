CREATE TABLE public.learning_profiles (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  summary text,
  strong_topics text[] NOT NULL DEFAULT '{}',
  weak_topics text[] NOT NULL DEFAULT '{}',
  learning_style text,
  recent_pattern text,
  focus_topic text,
  data_points integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_profiles TO authenticated;
GRANT ALL ON public.learning_profiles TO service_role;
ALTER TABLE public.learning_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own learning profile"
ON public.learning_profiles FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Parents, teachers and admins read learning profiles"
ON public.learning_profiles FOR SELECT TO authenticated
USING (
  public.is_parent_of(auth.uid(), student_id)
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.class_enrollments e
    JOIN public.classes c ON c.id = e.class_id
    WHERE e.student_id = learning_profiles.student_id AND c.teacher_id = auth.uid()
  )
);

CREATE TRIGGER learning_profiles_updated_at
BEFORE UPDATE ON public.learning_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'student',
  title text NOT NULL,
  body text NOT NULL,
  action_label text,
  action_link text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_insights_user_idx ON public.ai_insights (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own AI insights"
ON public.ai_insights FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Parents read their child's AI insights"
ON public.ai_insights FOR SELECT TO authenticated
USING (public.is_parent_of(auth.uid(), user_id));