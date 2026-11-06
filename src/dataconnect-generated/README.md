# Generated stubs — not wired into product paths

`@dataconnect/generated` and `@dataconnect/admin-generated` are local file dependencies for tooling compatibility.

- Product reads/writes go through Firestore Admin / client repo helpers, not Data Connect queries.
- Do not add new feature code that imports these packages without an explicit Data Connect rollout.
