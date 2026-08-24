# Error handling

User copy goes through `authErrorMessage` / `toUserMessage` / `mapFirebaseMessage`.

- Firebase codes (`auth/*`, `permission-denied`, `not-found`) map to short sentences.
- Offline / `client is offline` / `failed to fetch` map to a connection retry sentence.
- Stack traces and long internals are replaced with a generic retry message.
- Product errors from server functions (short, no newline) may still surface, e.g. “You are not enrolled in this class.”

Root route shows a retry/home screen, not `error.stack`. Webhooks return generic HTTP statuses. Classroom media errors should be treated as device permission issues, not raw DOMException dumps (Checkout and rewards toasts were switched to the mapper).
