import {
  doc,
  onSnapshot,
  query,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { refreshAuthClaims } from "@/features/auth/services/auth.service";
import { col, withId, type CollectionName } from "./repo";
import { getDb } from "./client";
import { backoffDelayMs, isPermissionDenied } from "./live-backoff";

/**
 * Firestore terminates a listener permanently on the first error (e.g. a `permission-denied`
 * from a stale token, or a chat listener opened a moment before the server wrote the
 * participant row that rules check). The app then looks "frozen until refresh".
 *
 * These helpers re-arm the listener with backoff; a permission error first forces a
 * token refresh so healed claims are picked up.
 */

type Resilient = {
  attach: (onError: (error: unknown) => void) => Unsubscribe;
  label: string;
};

function resilient({ attach, label }: Resilient): Unsubscribe {
  let active = true;
  let attempt = 0;
  let unsub: Unsubscribe | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const arm = () => {
    if (!active) return;
    unsub = attach((error) => {
      unsub = null;
      if (!active) return;
      const delay = backoffDelayMs(attempt);
      attempt += 1;
      console.warn(`[live] ${label} listener failed, retrying in ${delay}ms:`, error);
      const retry = async () => {
        if (isPermissionDenied(error)) await refreshAuthClaims();
        if (active) arm();
      };
      timer = setTimeout(() => void retry(), delay);
    });
  };

  arm();
  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    unsub?.();
  };
}

/** Live query: every snapshot delivers the full current row set; errors re-arm the listener. */
export function subscribeLive<T extends DocumentData>(
  name: CollectionName,
  constraints: QueryConstraint[],
  onRows: (rows: Array<T & { id: string }>) => void,
): Unsubscribe {
  return resilient({
    label: name,
    attach: (onError) =>
      onSnapshot(
        query(col(name), ...constraints),
        (snap) => onRows(snap.docs.map((d) => withId(d.id, d.data() as T))),
        onError,
      ),
  });
}

/** Live document: `null` when it does not exist; errors re-arm the listener. */
export function subscribeDocLive<T extends DocumentData>(
  name: CollectionName,
  id: string,
  onDoc: (row: (T & { id: string }) | null) => void,
): Unsubscribe {
  return resilient({
    label: `${name}/${id}`,
    attach: (onError) =>
      onSnapshot(
        doc(getDb(), name, id),
        (snap) => onDoc(snap.exists() ? withId(snap.id, snap.data() as T) : null),
        onError,
      ),
  });
}
