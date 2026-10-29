/** In-memory filter used when Firestore Enterprise RunQuery returns empty or errors. */
export function matchAdminFilter(
  row: Record<string, unknown>,
  field: string,
  op: string,
  value: unknown,
): boolean {
  const current = row[field];
  switch (op) {
    case "==":
      return current === value;
    case "!=":
      return current !== value;
    case "in":
      return Array.isArray(value) && (value as unknown[]).includes(current);
    case "not-in":
      return Array.isArray(value) && !(value as unknown[]).includes(current);
    case "array-contains":
      return Array.isArray(current) && current.includes(value);
    default:
      return false;
  }
}
