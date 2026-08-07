
-- =============== REWARDS ===============
CREATE TABLE public.reward_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  note text,
  source_id uuid,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reward_events_source_uq ON public.reward_events (student_id, kind, source_id) WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX reward_events_daily_uq ON public.reward_events (student_id, kind, day) WHERE source_id IS NULL;
CREATE INDEX reward_events_student_idx ON public.reward_events (student_id, created_at DESC);

GRANT SELECT, INSERT ON public.reward_events TO authenticated;
GRANT ALL ON public.reward_events TO service_role;
ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own rewards" ON public.reward_events FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.is_parent_of(auth.uid(), student_id) OR public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students log daily check-in" ON public.reward_events FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid() AND kind = 'daily_checkin' AND source_id IS NULL AND points <= 5);

CREATE OR REPLACE FUNCTION public.award_points(_student_id uuid, _kind text, _points integer, _source_id uuid, _note text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.reward_events (student_id, kind, points, source_id, note)
  VALUES (_student_id, _kind, _points, _source_id, _note)
  ON CONFLICT DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.award_points(uuid, text, integer, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reward_missed_work_reviewed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reviewed AND NOT COALESCE(OLD.reviewed, false) THEN
    PERFORM public.award_points(NEW.student_id, 'missed_work_reviewed', 15, NEW.id, NEW.title);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER missed_work_rewards AFTER UPDATE ON public.missed_work
FOR EACH ROW EXECUTE FUNCTION public.reward_missed_work_reviewed();

CREATE OR REPLACE FUNCTION public.reward_class_participation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(NEW.user_id, 'student') THEN RETURN NEW; END IF;
  PERFORM public.award_points(NEW.user_id, 'class_participation', 10, NEW.id, 'Joined a live class');
  RETURN NEW;
END; $$;
CREATE TRIGGER classroom_join_rewards AFTER INSERT ON public.classroom_participants
FOR EACH ROW EXECUTE FUNCTION public.reward_class_participation();

CREATE OR REPLACE FUNCTION public.reward_assessment_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pct numeric; _pts integer;
BEGIN
  IF NEW.status <> 'submitted' OR COALESCE(OLD.status, '') = 'submitted' THEN RETURN NEW; END IF;
  _pct := CASE WHEN NEW.total_points > 0
    THEN (COALESCE(NEW.manual_score, NEW.auto_score) / NEW.total_points) * 100 ELSE 0 END;
  _pts := CASE WHEN _pct >= 80 THEN 40 WHEN _pct >= 50 THEN 20 ELSE 10 END;
  PERFORM public.award_points(NEW.student_id, 'assessment', _pts, NEW.id, 'Assessment submitted');
  RETURN NEW;
END; $$;
CREATE TRIGGER assessment_rewards AFTER INSERT OR UPDATE ON public.assessment_submissions
FOR EACH ROW EXECUTE FUNCTION public.reward_assessment_result();

-- =============== MARKETPLACE ===============
CREATE TABLE public.marketplace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'book',
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_level text,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration_minutes integer,
  cover_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_items TO authenticated;
GRANT ALL ON public.marketplace_items TO service_role;
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can browse items" ON public.marketplace_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers and admins create items" ON public.marketplace_items FOR INSERT TO authenticated
WITH CHECK (seller_id = auth.uid() AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Sellers manage own items" ON public.marketplace_items FOR UPDATE TO authenticated
USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers delete own items" ON public.marketplace_items FOR DELETE TO authenticated
USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER marketplace_items_updated_at BEFORE UPDATE ON public.marketplace_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.marketplace_items(id) ON DELETE SET NULL,
  item_title text NOT NULL,
  item_kind text NOT NULL DEFAULT 'book',
  quantity integer NOT NULL DEFAULT 1,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'stub',
  reference text NOT NULL UNIQUE,
  scheduled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON public.orders (buyer_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers and sellers read orders" ON public.orders FOR SELECT TO authenticated
USING (
  buyer_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.marketplace_items m WHERE m.id = orders.item_id AND m.seller_id = auth.uid())
);
CREATE POLICY "Buyers create own orders" ON public.orders FOR INSERT TO authenticated
WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Buyers and admins update orders" ON public.orders FOR UPDATE TO authenticated
USING (buyer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (buyer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== BEHAVIOUR MANAGEMENT ===============
CREATE TABLE public.disciplinary_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'warning',
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX disciplinary_student_idx ON public.disciplinary_actions (student_id, active);
GRANT SELECT, INSERT, UPDATE ON public.disciplinary_actions TO authenticated;
GRANT ALL ON public.disciplinary_actions TO service_role;
ALTER TABLE public.disciplinary_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties read actions" ON public.disciplinary_actions FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  OR public.is_parent_of(auth.uid(), student_id)
  OR public.has_role(auth.uid(), 'teacher')
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Staff issue actions" ON public.disciplinary_actions FOR INSERT TO authenticated
WITH CHECK (issued_by = auth.uid() AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Staff update actions" ON public.disciplinary_actions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER disciplinary_actions_updated_at BEFORE UPDATE ON public.disciplinary_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.disciplinary_actions d
    WHERE d.student_id = _user_id
      AND d.kind = 'suspension'
      AND d.active
      AND d.starts_at <= now()
      AND (d.ends_at IS NULL OR d.ends_at > now())
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_disciplinary_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text;
BEGIN
  _title := CASE WHEN NEW.kind = 'suspension' THEN 'You have been suspended' ELSE 'You received a warning' END;
  INSERT INTO public.notifications (user_id, title, body, kind, link)
  VALUES (NEW.student_id, _title, NEW.reason, 'discipline', '/settings');
  INSERT INTO public.notifications (user_id, title, body, kind, link)
  SELECT p.parent_id,
         CASE WHEN NEW.kind = 'suspension' THEN 'Your child has been suspended' ELSE 'Your child received a warning' END,
         NEW.reason, 'discipline', '/dashboard'
  FROM public.parent_students p WHERE p.student_id = NEW.student_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER disciplinary_action_notify AFTER INSERT ON public.disciplinary_actions
FOR EACH ROW EXECUTE FUNCTION public.notify_disciplinary_action();

-- Suspension blocks live classrooms and messaging (never locker / missed work / notes)
DROP POLICY "Users join rooms as themselves" ON public.classroom_participants;
CREATE POLICY "Users join rooms as themselves" ON public.classroom_participants FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT public.is_suspended(auth.uid())
  AND (public.teaches_class(auth.uid(), public.session_class_id(session_id))
       OR public.is_enrolled(auth.uid(), public.session_class_id(session_id))
       OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY "Room members send chat" ON public.classroom_messages;
CREATE POLICY "Room members send chat" ON public.classroom_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND NOT public.is_suspended(auth.uid())
  AND (public.teaches_class(auth.uid(), public.session_class_id(session_id))
       OR public.is_enrolled(auth.uid(), public.session_class_id(session_id))
       OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND NOT public.is_suspended(auth.uid())
  AND public.is_conversation_member(auth.uid(), conversation_id)
);

DROP POLICY "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND NOT public.is_suspended(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.reward_missed_work_reviewed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reward_class_participation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reward_assessment_result() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_disciplinary_action() FROM PUBLIC, anon, authenticated;
