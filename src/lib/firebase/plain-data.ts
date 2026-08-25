/** Firestore rejects `undefined`. Drop those keys so writes can succeed. */
export function plainFirestoreData<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === "object" && item.constructor === Object
          ? plainFirestoreData(item as Record<string, unknown>)
          : item,
      );
    } else if (value && typeof value === "object" && value.constructor === Object) {
      out[key] = plainFirestoreData(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
