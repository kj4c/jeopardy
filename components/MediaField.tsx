"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/api";
import { parseYouTube, youtubeUrl } from "@/lib/board";
import type { Media } from "@/lib/types";
import { MediaRenderer } from "./MediaRenderer";

type Tab = "none" | "image" | "youtube";

export function MediaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Media;
  onChange: (media: Media | undefined) => void;
}) {
  const [tab, setTab] = useState<Tab>(value?.type ?? "none");
  const [ytText, setYtText] = useState(value?.type === "youtube" ? youtubeUrl(value) : "");
  const [ytError, setYtError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      onChange({ type: "image", src: await uploadImage(file) });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function selectTab(next: Tab) {
    setTab(next);
    if (next === "none") onChange(undefined);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label">{label}</span>
        <div className="flex border border-line-strong text-xs">
          {(["none", "image", "youtube"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectTab(t)}
              className={`px-2.5 py-1 capitalize transition ${tab === t ? "bg-coral/20 text-cream" : "text-muted hover:text-cream"}`}
            >
              {t === "youtube" ? "YouTube" : t}
            </button>
          ))}
        </div>
      </div>

      {tab === "image" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          onPaste={(e) => handleFile(e.clipboardData.files[0])}
          className={`relative flex min-h-32 flex-col items-center justify-center gap-2 border border-dashed p-3 text-center transition ${
            dragging ? "border-coral bg-coral/10" : "border-line-strong"
          }`}
        >
          {value?.type === "image" ? (
            <>
              <div className="flex w-full justify-center">
                <MediaRenderer media={value} maxHeight="12rem" />
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                  Replace
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(undefined)}>
                  Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">{uploading ? "Uploading…" : "Drop, paste, or choose an image"}</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                Choose file
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {tab === "youtube" && (
        <div className="space-y-2">
          <input
            className="field"
            placeholder="https://youtube.com/watch?v=… or youtu.be/…"
            value={ytText}
            onChange={(e) => {
              const text = e.target.value;
              setYtText(text);
              const media = parseYouTube(text);
              setYtError(text && !media ? "That doesn't look like a YouTube link" : "");
              if (media || !text) onChange(media ?? undefined);
            }}
          />
          {ytError && <p className="text-xs text-bad">{ytError}</p>}
          {value?.type === "youtube" && <MediaRenderer media={value} />}
        </div>
      )}
    </div>
  );
}
