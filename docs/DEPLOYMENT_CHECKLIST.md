# Deployment checklist

## Security

- [ ] Authentication uses custom claims
- [ ] Firestore rules deployed (Phase 7 messaging/orders/parent/rewards/marketplace)
- [ ] Storage rules deployed (MIME + size)
- [ ] API / server functions require Firebase ID token
- [ ] AI gateway credentials server-only
- [ ] Classroom tokens server-only
- [ ] Assessment keys Admin-only
- [ ] Orders not client-writable
- [ ] Secrets not in git

## Data

- [ ] School isolation on academic collections
- [ ] PITR / export configured (human — see BACKUP_AND_RECOVERY)
- [ ] Indexes deployed

## Performance

- [ ] Timetable listener school-scoped
- [ ] Overview query bounded
- [ ] Chat/marketplace limits

## UX

- [ ] Loading / empty / error states on major screens (existing)
- [ ] Authenticated `noindex`

## Testing

- [x] `tsc --noEmit` (run in Phase 7 completion)
- [x] Lint of touched files
- [x] Marking + error-mapping unit checks
- [x] Production build
- [x] Rules syntax validation
- [ ] Emulator rules tests
- [ ] E2E journeys
- [ ] Device lab

## Config

- [ ] Production `.env` / host secrets
- [ ] Auth authorized domains
- [ ] Flutterwave webhook URL + hash
- [ ] LiveKit URL + webhook
- [ ] Crane5 URL + key
- [ ] App Check (optional)
- [ ] Blaze only if Functions/App Hosting are required
