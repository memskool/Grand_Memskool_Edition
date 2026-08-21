-- Repair NULL auth token columns that break sign-in
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE confirmation_token IS NULL
   OR recovery_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR email_change IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL;

-- Ensure the single admin account exists with the requested password
UPDATE auth.users
SET encrypted_password = extensions.crypt('Memskooladmin2026', extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'admin@memskool.com';

-- admin@memskool.com is the only admin; demote any other admin to teacher
DELETE FROM public.user_roles ur
USING auth.users u
WHERE ur.user_id = u.id AND ur.role = 'admin' AND u.email <> 'admin@memskool.com';

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'teacher'::public.app_role FROM auth.users u
WHERE u.email <> 'admin@memskool.com'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role FROM auth.users u
WHERE u.email = 'admin@memskool.com'
ON CONFLICT (user_id, role) DO NOTHING;