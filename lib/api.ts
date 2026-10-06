"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, (data.error as string) ?? res.statusText, data);
  return data as T;
}

const MAX_DIMENSION = 1800;

/** Downscales large photos in the browser before upload. GIFs are sent as-is to keep animation. */
export async function uploadImage(file: File, boardId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  let blob: Blob = file;
  if (file.type !== "image/gif") {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale < 1 || file.size > 1.5 * 1024 * 1024) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/webp", 0.86),
      );
    }
    bitmap.close();
  }
  const { url } = await api<{ url: string }>(`/api/upload?board=${encodeURIComponent(boardId)}`, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  return url;
}
