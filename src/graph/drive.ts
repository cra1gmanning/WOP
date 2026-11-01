import { driveChildrenUrl, driveContentUrl, driveItemUrl } from "../lib/paths";

export interface Drive {
  getJson<T>(path: string): Promise<T | null>;
  putJson(path: string, data: unknown): Promise<void>;
  putBlob(path: string, blob: Blob, contentType: string): Promise<void>;
  downloadUrl(path: string): Promise<string>;
}

async function errorFrom(response: Response, action: string): Promise<Error> {
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {
    detail = "";
  }
  return new Error(`Could not ${action} (${response.status}). ${detail}`.trim());
}

export function createDrive(token: () => Promise<string>): Drive {
  async function call(url: string, init: RequestInit = {}): Promise<Response> {
    const access = await token();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${access}`);
    return fetch(url, { ...init, headers });
  }

  async function ensureParents(filePath: string): Promise<void> {
    const parts = filePath.split("/").filter(Boolean).slice(0, -1);
    let parent = "";
    for (const name of parts) {
      const next = parent ? `${parent}/${name}` : name;
      const existing = await call(driveItemUrl(next));
      if (existing.status === 404) {
        const created = await call(driveChildrenUrl(parent), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
        });
        if (!created.ok && created.status !== 409) throw await errorFrom(created, `create folder ${name}`);
      } else if (!existing.ok) {
        throw await errorFrom(existing, `open folder ${name}`);
      }
      parent = next;
    }
  }

  return {
    async getJson<T>(filePath: string): Promise<T | null> {
      const response = await call(driveContentUrl(filePath));
      if (response.status === 404) return null;
      if (!response.ok) throw await errorFrom(response, "read OneDrive");
      return (await response.json()) as T;
    },
    async putJson(filePath: string, data: unknown): Promise<void> {
      await ensureParents(filePath);
      const response = await call(driveContentUrl(filePath), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await errorFrom(response, "save to OneDrive");
    },
    async putBlob(filePath: string, blob: Blob, contentType: string): Promise<void> {
      await ensureParents(filePath);
      const response = await call(driveContentUrl(filePath), {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: blob,
      });
      if (!response.ok) throw await errorFrom(response, "upload to OneDrive");
    },
    async downloadUrl(filePath: string): Promise<string> {
      const response = await call(driveItemUrl(filePath));
      if (response.status === 404) throw new Error(`That video is not in OneDrive at ${filePath}.`);
      if (!response.ok) throw await errorFrom(response, "open the video");
      const body = (await response.json()) as { "@microsoft.graph.downloadUrl"?: string };
      if (!body["@microsoft.graph.downloadUrl"]) throw new Error("OneDrive did not return a playback link.");
      return body["@microsoft.graph.downloadUrl"];
    },
  };
}

export async function fetchVideoBlob(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("This phone blocked saving the video for offline use. Playback still works while you are online.");
  }
  if (!response.ok || !response.body) {
    throw new Error(`Could not download the video (${response.status || "network"}).`);
  }
  const total = Number(response.headers.get("content-length") || 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    loaded += step.value.byteLength;
    onProgress?.(loaded, total);
  }
  const parts: BlobPart[] = chunks.map((chunk) => {
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    return copy;
  });
  return new Blob(parts, { type: "video/mp4" });
}
