-- 1) Remove client-side write access to orders: only the server (service role) may write.
DROP POLICY IF EXISTS "Buyers create own orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers and admins update orders" ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

-- 2) Payment tracking columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS provider_tx_id text,
  ADD COLUMN IF NOT EXISTS verified_amount_cents integer,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_tx_unique
  ON public.orders (provider, provider_tx_id)
  WHERE provider_tx_id IS NOT NULL;

-- 3) Webhook event log for idempotency / auditing
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  order_reference text,
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_event_unique
  ON public.payment_events (provider, event_id);

GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read payment events"
  ON public.payment_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.payment_events TO authenticated;