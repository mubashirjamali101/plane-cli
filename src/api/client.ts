import type { Config } from "../config.ts";
import { ApiError } from "../errors.ts";
import type { Asset } from "./types.ts";

/** Plane paginates some endpoints; unwrap `{ results: [...] }` and pass arrays through. */
function toList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    const results = (data as { results: unknown }).results;
    return Array.isArray(results) ? results : [];
  }
  return [];
}

/** Thin HTTP layer over the Plane REST API. Throws `ApiError` on any non-2xx response. */
export class PlaneClient {
  constructor(private readonly config: Config) {}

  get workspace(): string {
    return this.config.workspace;
  }

  /** The instance root, i.e. the base URL without its `/api/v1` suffix. */
  get origin(): string {
    return this.config.baseUrl.replace(/\/api\/v\d+$/, "");
  }

  /** Absolute URL for an API path, for the few places that fetch outside `request`. */
  url(path: string): string {
    return `${this.config.baseUrl}/${path.replace(/^\/+/, "")}`;
  }

  async get<T>(path: string): Promise<T> {
    return (await this.request("GET", path)) as T;
  }

  async getList<T>(path: string): Promise<T[]> {
    return toList(await this.request("GET", path)) as T[];
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return (await this.request("POST", path, body)) as T;
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return (await this.request("PATCH", path, body)) as T;
  }

  async delete(path: string): Promise<void> {
    await this.request("DELETE", path);
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = this.url(path);
    const response = await fetch(url, {
      method,
      headers: {
        "x-api-key": this.config.apiKey,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, method, url, await safeText(response));
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  /** Fetch asset bytes with authentication, following Plane's redirect to object storage. */
  async fetchAsset(url: string): Promise<Asset> {
    const response = await fetch(url, {
      headers: { "x-api-key": this.config.apiKey },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, "GET", url, await safeText(response));
    }
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "",
    };
  }

  /** Upload bytes straight to object storage using Plane's presigned form fields. */
  async uploadToStorage(
    target: { url: string; fields: Record<string, string> },
    bytes: Uint8Array,
    filename: string,
    contentType: string
  ): Promise<void> {
    const form = new FormData();
    for (const [field, value] of Object.entries(target.fields)) form.append(field, value);
    form.append("file", new Blob([bytes], { type: contentType }), filename);

    const response = await fetch(target.url, { method: "POST", body: form });
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, "POST", target.url, await safeText(response));
    }
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
