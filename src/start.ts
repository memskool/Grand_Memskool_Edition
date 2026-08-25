import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { isBrowserDocumentRequest, renderErrorPage } from "./lib/error-page";
import { attachFirebaseAuth } from "@/lib/firebase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    if (!isBrowserDocumentRequest(getRequest())) throw error;
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
