# Browser compatibility

Supported **intent**: current Chrome, Edge, Firefox, and Safari (desktop + iOS).

| Feature | Limitation |
| --- | --- |
| Live classroom | Needs WebRTC; host screen share needs `getDisplayMedia` (typically desktop). |
| Push | Needs VAPID + a supporting browser; iOS has extra home-screen constraints. |
| Exam timer | Works after refresh; Safari ITP does not replace server `ends_at`. |
| Speech in AI tutor | Browser SpeechRecognition / speechSynthesis — not all engines. |

**Not run:** a matrix of real Safari/Firefox/Edge devices in this phase. Treat this as an engineering review, not a QA sign-off.
