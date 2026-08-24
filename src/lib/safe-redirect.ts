/** In-app paths only. Blocks protocol-relative and external URLs. */
export function safeAppPath(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  if (value.startsWith("/auth") || value.startsWith("/onboarding")) return null;
  return value;
}

export type AuthSearch = {
  redirect?: string | undefined;
};

export function parseAuthSearch(search: Record<string, unknown>): AuthSearch {
  const redirect = typeof search["redirect"] === "string" ? safeAppPath(search["redirect"]) : null;
  return redirect ? { redirect } : {};
}
