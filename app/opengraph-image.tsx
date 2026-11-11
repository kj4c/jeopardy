import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_GRADIENT, CREAM, HALFTONE, INK, LAYER, WASHES } from "@/lib/cardArt";

export const alt = "KASHMONEY: live trivia with phone buzzers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const serif = await readFile(join(process.cwd(), "assets/fonts/InstrumentSerif-Regular.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: INK, color: CREAM }}>
        <div style={{ ...LAYER, backgroundImage: WASHES }} />
        <div style={{ ...LAYER, ...HALFTONE }} />
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
              backgroundImage: BRAND_GRADIENT,
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
