"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "../Modal";
import { usePhoneUrl } from "./JoinPanel";

export function HostRemoteDialog({ slug, connected, onClose }: { slug: string; connected?: number; onClose: () => void }) {
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [qr, setQr] = useState("");
  const url = usePhoneUrl(key ? `/remote/${slug}?k=${key}` : null);

  useEffect(() => {
    api<{ key: string }>(`/api/rooms/${slug}/remote-key`)
      .then((r) => setKey(r.key))
      .catch(() => setError(true));
  }, [slug]);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#161211", light: "#f3ece6" } }).then(setQr);
  }, [url]);

  async function resetKey() {
    if (!confirm("Make a new host QR? Any phone using the old one is disconnected.")) return;
    setQr("");
    const r = await api<{ key: string }>(`/api/rooms/${slug}/remote-key`, { method: "POST" }).catch(() => null);
    if (r) setKey(r.key);
    else setError(true);
  }

  return (
    <Modal title="Host phone" subtitle="Answers on your phone" onClose={onClose}>
      <p className="mb-6 text-lg text-muted">
        Scan this yourself. Your phone shows the question and its answer whenever a tile is picked.{" "}
        <span className="text-cream">Don&apos;t let players see this code.</span>
      </p>
      <div className="flex flex-col items-center gap-4">
        {error ? (
          <p className="text-bad">Couldn&apos;t load the host QR. Try again.</p>
        ) : qr ? (
          <img src={qr} alt="Host remote QR code" className="corner-marks w-full max-w-64" />
        ) : (
          <div className="aspect-square w-full max-w-64 bg-surface" />
        )}
        {connected !== undefined && (
          <p className={connected ? "text-good" : "text-muted"}>
            {connected ? `📱 ${connected === 1 ? "Host phone" : `${connected} host phones`} connected` : "No host phone connected yet"}
          </p>
        )}
      </div>
      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <button className="btn btn-ghost" onClick={resetKey}>
          New QR (disconnect phones)
        </button>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
