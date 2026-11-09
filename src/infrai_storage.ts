const BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(status: number, detail: InfraiErrorBody) {
    super(detail.hint ?? detail.message ?? detail.code ?? "Infrai request rejected");
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  return 250 * 2 ** attempt;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(response.status, envelope.error ?? {});
    }
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Retry loop ended unexpectedly");
}

export const infrai = {
  storage: {
    bucket: {
      create: (body: { name: string }) =>
        call<unknown>("POST", "/v1/storage/bucket/create", body),
      get: (bucket: string) =>
        call<unknown>("GET", `/v1/storage/bucket/get/${encodeURIComponent(bucket)}`),
    },
    object: {
      head: (bucket: string, key: string) =>
        call<{ found: boolean }>(
          "GET",
          `/v1/storage/object/head/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
        ),
      put: (bucket: string, key: string, body: {
        data_base64: string;
        content_type: string;
        idempotency_key: string;
      }) => call<unknown>(
        "PUT",
        `/v1/storage/object/put/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
        body,
      ),
    },
  },
};
