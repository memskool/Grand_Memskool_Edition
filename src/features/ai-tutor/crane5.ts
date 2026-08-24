export type Crane5Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Crane5Result = {
  text: string;
  streamed: boolean;
  model: string;
  latencyMs: number;
};

function config() {
  const url = process.env["CRANE5_API_URL"]?.trim();
  const key = process.env["CRANE5_API_KEY"]?.trim();
  return { url, key, vision: process.env["CRANE5_VISION"] === "true" };
}

export function crane5Configured(): boolean {
  const { url, key } = config();
  return Boolean(url && key);
}

/**
 * Crane5 HTTP adapter.
 *
 * Expected default: OpenAI-compatible POST { messages, model, stream:false }
 * at CRANE5_API_URL with Bearer CRANE5_API_KEY.
 *
 * Crane5's public site does not currently document this API. Until the URL and
 * key are provisioned, the gateway refuses tutoring instead of calling another model.
 */
export async function callCrane5(input: {
  messages: Crane5Message[];
  stream?: boolean;
}): Promise<Crane5Result> {
  const { url, key } = config();
  if (!url || !key) {
    throw new Error("The tutor is not configured yet. Ask the workspace owner to connect Crane5.");
  }

  const started = Date.now();
  const model = process.env["CRANE5_MODEL"]?.trim() || "crane5-tutor";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: input.messages,
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new Error("The tutor is taking longer than expected. Please try again.");
    }
    if (res.status === 402) {
      throw new Error("Tutor credits are exhausted. Ask the workspace owner to top up Crane5.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("The tutor could not be reached. Please try again later.");
    }
    if (!res.ok) {
      throw new Error("The tutor is taking longer than expected. Please try again.");
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      result?: string;
      content?: string;
      text?: string;
    };
    const text =
      json.choices?.[0]?.message?.content ?? json.result ?? json.content ?? json.text ?? "";
    if (!text.trim()) {
      throw new Error("The tutor returned an empty reply. Please try again.");
    }
    return { text: text.trim(), streamed: false, model, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The tutor is taking longer than expected. Please try again.");
    }
    if (error instanceof Error && /tutor|credits|configured|reached/i.test(error.message)) {
      throw error;
    }
    throw new Error("The tutor is taking longer than expected. Please try again.");
  } finally {
    clearTimeout(timeout);
  }
}

export function crane5VisionEnabled() {
  return config().vision;
}
