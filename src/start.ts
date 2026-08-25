import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachFirebaseAuth } from "@/lib/firebase/auth-attacher";

function isHtmlDocumentNavigation(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.get("authorization")) return false;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("json") || contentType.includes("x-www-form-urlencoded")) return false;
  const dest = request.headers.get("sec-fetch-dest");
  if (dest === "empty" || dest === "cors") return false;
  if (dest === "document" || dest === "iframe" || dest === "frame") return true;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    if (!isHtmlDocumentNavigation(getRequest())) throw error;
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  // Server functions authenticate with a Firebase Bearer token, not cookies.
  // CSRF origin checks were rejecting memskool.com RPCs and returning HTML 500s.
  filter: () => false,
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachFirebaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
