import { useEffect, useState } from "react";

/** Honest offline notice. Does not claim live video or AI will work without a connection. */
export function NetworkBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (online) return null;

  return (
    <p
      role="status"
      className="border-b border-border bg-secondary px-4 py-2 text-center text-sm text-foreground"
    >
      You appear to be offline. Work already on this device may still be available. Live classes and
      new AI answers need an internet connection.
    </p>
  );
}
