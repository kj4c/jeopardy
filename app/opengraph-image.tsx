import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "KASHMONEY: live trivia with phone buzzers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const WASHES = [
  "radial-gradient(ellipse at 100% 0%, rgba(255,79,154,0.95) 0%, rgba(255,111,200,0.5) 30%, transparent 62%)",
  "radial-gradient(ellipse at 0% 100%, rgba(59,75,220,0.95) 0%, rgba(122,79,224,0.55) 32%, transparent 64%)",
  "radial-gradient(ellipse at 100% 100%, rgba(245,161,74,0.8) 0%, rgba(255,79,154,0.3) 28%, transparent 50%)",
  "radial-gradient(ellipse at 0% 0%, rgba(122,79,224,0.35) 0%, transparent 45%)",
].join(", ");

const LAYER = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" } as const;

export default async function OpengraphImage() {
  const serif = await readFile(join(process.cwd(), "assets/fonts/InstrumentSerif-Regular.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#161211", color: "#fff7ea" }}>
        <div style={{ ...LAYER, backgroundImage: WASHES }} />
        <div
          style={{
            ...LAYER,
            backgroundImage: "radial-gradient(circle at center, rgba(22,18,17,0.75) 0%, rgba(22,18,17,0.75) 32%, transparent 48%)",
            backgroundSize: "6px 6px",
            backgroundRepeat: "repeat",
          }}
        />
        <div
          style={{
            ...LAYER,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 28, letterSpacing: 9, opacity: 0.8 }}>LIVE TRIVIA · PHONE BUZZERS</div>
          <div
            style={{
              fontFamily: "Instrument Serif",
              fontSize: 250,
              lineHeight: 1,
              letterSpacing: -5,
              padding: "10px 20px 30px",
              backgroundImage: "linear-gradient(100deg, #ff7a6b 0%, #ff6fc8 45%, #f5a14a 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            KASHMONEY.
          </div>
          <div style={{ fontFamily: "Instrument Serif", fontSize: 46, opacity: 0.9 }}>Grab your phone and buzz in.</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Instrument Serif", data: serif, weight: 400, style: "normal" }] },
  );
}
