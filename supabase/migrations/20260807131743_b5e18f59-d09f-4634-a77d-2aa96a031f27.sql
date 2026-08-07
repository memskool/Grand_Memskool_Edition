-- ===== Classroom sessions =====
CREATE TABLE public.classroom_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_sessions TO authenticated;
GRANT ALL ON public.classroom_sessions TO service_role;
ALTER TABLE public.classroom_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class members can view sessions" ON public.classroom_sessions
FOR SELECT TO authenticated
USING (public.teaches_class(auth.uid(), class_id) OR public.is_enrolled(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Teachers can start sessions" ON public.classroom_sessions
FOR INSERT TO authenticated
WITH CHECK (host_id = auth.uid() AND (public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Hosts can update sessions" ON public.classroom_sessions
FOR UPDATE TO authenticated
USING (host_id = auth.uid() OR public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'))
WITH CHECK (host_id = auth.uid() OR public.teaches_class(auth.uid(), class_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Hosts can delete sessions" ON public.classroom_sessions
FOR DELETE TO authenticated
USING (host_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER classroom_sessions_updated_at BEFORE UPDATE ON public.classroom_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX classroom_sessions_one_active ON public.classroom_sessions (class_id) WHERE is_active;

-- ===== Participants =====
CREATE TABLE public.classroom_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  hand_raised boolean NOT NULL DEFAULT false,
  mic_on boolean NOT NULL DEFAULT false,
  cam_on boolean NOT NULL DEFAULT false,
  camera_allowed boolean NOT NULL DEFAULT true,
  warned_at timestamptz,
  is_host boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_participants TO authenticated;
GRANT ALL ON public.classroom_participants TO service_role;
ALTER TABLE public.classroom_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.session_class_id(_session_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM public.classroom_sessions WHERE id = _session_id;
$$;

CREATE POLICY "Room members can view participants" ON public.classroom_participants
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.teaches_class(auth.uid(), public.session_class_id(session_id))
  OR public.is_enrolled(auth.uid(), public.session_class_id(session_id))
  OR public.has_role(auth.uid(),'admin')
);

CREATE POLICY "Users join rooms as themselves" ON public.classroom_participants
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.teaches_class(auth.uid(), public.session_class_id(session_id))
    OR public.is_enrolled(auth.uid(), public.session_class_id(session_id))
    OR public.has_role(auth.uid(),'admin')
  )
);

CREATE POLICY "Self or teacher can update participant" ON public.classroom_participants
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.teaches_class(auth.uid(), public.session_class_id(session_id)) OR public.has_role(auth.uid(),'admin'))
WITH CHECK (user_id = auth.uid() OR public.teaches_class(auth.uid(), public.session_class_id(session_id)) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Self or teacher can remove participant" ON public.classroom_participants
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.teaches_class(auth.uid(), public.session_class_id(session_id)) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER classroom_participants_updated_at BEFORE UPDATE ON public.classroom_participants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Automated attendance on join =====
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_class_date_key
  ON public.attendance (student_id, class_id, date) WHERE class_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.log_classroom_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _class_id uuid;
BEGIN
  SELECT class_id INTO _class_id FROM public.classroom_sessions WHERE id = NEW.session_id;
  IF _class_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.attendance (student_id, class_id, date, status)
  VALUES (NEW.user_id, _class_id, (NEW.joined_at AT TIME ZONE 'UTC')::date, 'present')
  ON CONFLICT (student_id, class_id, date) WHERE class_id IS NOT NULL
  DO UPDATE SET status = 'present';
  RETURN NEW;
END;
$$;

CREATE TRIGGER classroom_join_attendance AFTER INSERT ON public.classroom_participants
FOR EACH ROW EXECUTE FUNCTION public.log_classroom_attendance();

-- ===== Messaging =====
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'direct',
  title text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = _conversation_id AND m.user_id = _user_id);
$$;

CREATE POLICY "Members can view conversations" ON public.conversations
FOR SELECT TO authenticated USING (public.is_conversation_member(auth.uid(), id) OR created_by = auth.uid());
CREATE POLICY "Users can create conversations" ON public.conversations
FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creators can update conversations" ON public.conversations
FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creators can delete conversations" ON public.conversations
FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Members can view membership" ON public.conversation_members
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "Members can be added by participants" ON public.conversation_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_conversation_member(auth.uid(), conversation_id)
  OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
);
CREATE POLICY "Users update own membership" ON public.conversation_members
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users leave conversations" ON public.conversation_members
FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read messages" ON public.messages
FOR SELECT TO authenticated USING (public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "Members can send messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "Senders can delete own messages" ON public.messages
FOR DELETE TO authenticated USING (sender_id = auth.uid());

CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at);

-- Live classroom chat messages
CREATE TABLE public.classroom_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.classroom_sessions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.classroom_messages TO authenticated;
GRANT ALL ON public.classroom_messages TO service_role;
ALTER TABLE public.classroom_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members read chat" ON public.classroom_messages
FOR SELECT TO authenticated
USING (
  public.teaches_class(auth.uid(), public.session_class_id(session_id))
  OR public.is_enrolled(auth.uid(), public.session_class_id(session_id))
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "Room members send chat" ON public.classroom_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.teaches_class(auth.uid(), public.session_class_id(session_id))
    OR public.is_enrolled(auth.uid(), public.session_class_id(session_id))
    OR public.has_role(auth.uid(),'admin')
  )
);
CREATE POLICY "Senders delete own chat" ON public.classroom_messages
FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- ===== Blocks and mutes =====
CREATE TABLE public.user_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_id, relation)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_relations TO authenticated;
GRANT ALL ON public.user_relations TO service_role;
ALTER TABLE public.user_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own relations" ON public.user_relations
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== Realtime =====
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.classroom_messages REPLICA IDENTITY FULL;
ALTER TABLE public.classroom_participants REPLICA IDENTITY FULL;
ALTER TABLE public.classroom_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_sessions;