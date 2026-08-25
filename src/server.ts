import "./lib/error-capture";

import { consumeLastCapturedError, describeError } from "./lib/error-capture";
import { isBrowserDocumentRequest, jsonServerError, renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into {"unhandled":true,"message":"HTTPError"}.
// That used to be rewritten as an HTML page for every 500 — including school signup RPCs.
async function normalizeCatastrophicSsrResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!isBrowserDocumentRequest(request) && (contentType.includes("text/html") || !contentType)) {
      const text = await response.clone().text();
      if (
        text.trim().toLowerCase().startsWith("<!doctype") ||
        text.trim().toLowerCase().startsWith("<html")
      ) {
        const captured = consumeLastCapturedError();
        if (captured) console.error(describeError(captured));
        return jsonServerError("Could not finish saving. Please try again.");
      }
    }
    return response;
  }

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const captured = consumeLastCapturedError();
  console.error(captured ?? new Error(`h3 swallowed SSR error: ${body}`));
  if (!isBrowserDocumentRequest(request)) {
    const raw = captured instanceof Error ? captured.message : "";
    const message =
      raw && raw.length <= 180 && !raw.toLowerCase().includes("httperror")
        ? raw.split(/\r?\n/)[0]!.trim()
        : "Could not finish saving. Please try again.";
    return jsonServerError(message);
  }
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request, response);
    } catch (error) {
      console.error(error);
      if (!isBrowserDocumentRequest(request)) {
        const message =
          error instanceof Error &&
          error.message &&
          !error.message.toLowerCase().includes("httperror")
            ? error.message.split(/\r?\n/)[0]!.trim()
            : "Could not finish saving. Please try again.";
        return jsonServerError(message);
      }
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
