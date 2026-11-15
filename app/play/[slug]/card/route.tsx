import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { formatScore } from "@/lib/board";
import { BRAND_GRADIENT, CREAM, HALFTONE, INK, LAYER, WASHES } from "@/lib/cardArt";
import { awards, type Award } from "@/lib/recap";
import type { GameStats, Team } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Results = { name: string; ended: boolean; teams: Team[]; stats: GameStats };

const MUTED = "rgba(255,247,234,0.62)";
const PANEL = { border: "2px solid rgba(255,247,234,0.16)", background: "rgba(22,18,17,0.72)" } as const;
const FONT_FILE = "InstrumentSerif-Regular.ttf";

/** Prefer the live HTTP API. On some hosts loopback is blocked, so also try the public hostname. */
async function loadResults(slug: string, req: Request): Promise<Results | null> {
  const port = process.env.PORT || "3000";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const bases = [`http://127.0.0.1:${port}`, `http://[::1]:${port}`, `http://localhost:${port}`];
  if (host) bases.push(`${proto}://${host}`);

  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/public/rooms/${encodeURIComponent(slug)}/results`, { cache: "no-store" });
      if (res.ok) return (await res.json()) as Results;
    } catch {
      // try the next base
    }
  }
  return null;
}

/** Same font as the link preview. Try disk paths first, then the public URL (reliable on Railway). */
async function loadSerif(req: Request): Promise<Buffer> {
  const diskPaths = [
    join(process.cwd(), "assets/fonts", FONT_FILE),
    join(process.cwd(), "public/fonts", FONT_FILE),
  ];
  for (const path of diskPaths) {
    try {
      return await readFile(path);
    } catch {
      // try the next path
    }
  }

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const port = process.env.PORT || "3000";
  const bases = host
    ? [`${proto}://${host}`, `http://127.0.0.1:${port}`]
    : [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/fonts/${FONT_FILE}`, { cache: "force-cache" });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {
      // try the next base
    }
  }
  throw new Error(`Could not load ${FONT_FILE}`);
}

/** Story-sized (9:16) results image. Instrument Serif only — extra fonts and emoji often fail on Linux hosts. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = await loadResults(slug, req);
    if (!data) return new Response("Room not found", { status: 404 });

    const teams = [...data.teams].sort((a, b) => b.score - a.score);
    const winner = teams[0];
    const tied = teams.length > 1 && teams[1].score === winner?.score;
    const headline = !winner ? "No teams yet" : !data.ended ? "Standings so far" : tied ? "It's a tie!" : winner.name;
    const headlineSize = headline.length > 16 ? 104 : headline.length > 10 ? 132 : 168;
    const site = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "www.kashmoney.xyz").replace(/^www\./, "");
    const list = awards(data.stats, data.teams).slice(0, 4);
    const serif = await loadSerif(req);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            position: "relative",
            background: INK,
            color: CREAM,
            fontFamily: "Instrument Serif",
          }}
        >
          <div style={{ ...LAYER, backgroundImage: WASHES }} />
          <div style={{ ...LAYER, ...HALFTONE }} />
          <div style={{ ...LAYER, flexDirection: "column", padding: "110px 90px 90px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 96,
                  lineHeight: 1,
                  padding: "0 10px 12px",
                  backgroundImage: BRAND_GRADIENT,
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                KASHMONEY.
              </div>
              <div style={{ display: "flex", fontSize: 28, letterSpacing: 7, color: MUTED, textTransform: "uppercase" }}>
                {data.name}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: headlineSize,
                    lineHeight: 1,
                    textAlign: "center",
                    color: data.ended && !tied && winner ? winner.color : CREAM,
                  }}
                >
                  {headline}
                </div>
                {data.ended && winner && (
                  <div style={{ display: "flex", fontSize: 44, marginTop: 18, color: MUTED }}>
                    {tied ? `Level on ${formatScore(winner.score)}` : `wins with ${formatScore(winner.score)}`}
                  </div>
                )}
                {!data.ended && (
                  <div style={{ display: "flex", fontSize: 36, marginTop: 18, color: MUTED }}>Game in progress</div>
                )}
              </div>
              <Standings teams={teams.slice(0, 6)} />
              <Awards list={list} />
            </div>

            <div style={{ display: "flex", justifyContent: "center", fontSize: 30, letterSpacing: 6, color: MUTED }}>
              {`PLAY AT ${site.toUpperCase()}`}
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
        fonts: [{ name: "Instrument Serif", data: serif, weight: 400, style: "normal" }],
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("results card failed", err);
    return new Response(`Card failed: ${err instanceof Error ? err.message : "unknown error"}`, { status: 500 });
  }
}

function Standings({ teams }: { teams: Team[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 80, ...PANEL }}>
      {teams.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "26px 36px",
            borderTop: i ? "2px solid rgba(255,247,234,0.1)" : "none",
          }}
        >
          <div style={{ display: "flex", width: 70, fontSize: 36, color: MUTED }}>{i + 1}</div>
          <div style={{ display: "flex", width: 26, height: 26, borderRadius: 13, background: t.color, marginRight: 26 }} />
          <div style={{ display: "flex", flex: 1, fontSize: 46, color: t.color }}>{t.name}</div>
          <div style={{ display: "flex", fontSize: 46 }}>{formatScore(t.score)}</div>
        </div>
      ))}
    </div>
  );
}

function Awards({ list }: { list: Award[] }) {
  if (!list.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", marginTop: 40 }}>
      {list.map((a) => (
        <div
          key={a.title}
          style={{ display: "flex", flexDirection: "column", width: "49%", marginBottom: 20, padding: "22px 26px", ...PANEL }}
        >
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: MUTED, textTransform: "uppercase" }}>
            {a.title}
          </div>
          <div style={{ display: "flex", fontSize: 44, lineHeight: 1.1, color: a.color ?? CREAM }}>{a.who}</div>
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{a.detail}</div>
        </div>
      ))}
    </div>
  );
}
