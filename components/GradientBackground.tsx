type Props = {
  /** Shifts the gradient towards a colour, e.g. the team that buzzed first. */
  accent?: string;
  variant?: "hero" | "subtle";
  waves?: boolean;
  pixels?: boolean;
};

export function GradientBackground({ accent, variant = "subtle", waves = true, pixels = false }: Props) {
  const strength = variant === "hero" ? 1 : 0.55;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      <div
        className="absolute left-[18%] top-[-25%] h-[120%] w-[85%]"
        style={{ animation: "drift 26s ease-in-out infinite", opacity: `calc(var(--blob-opacity) * ${strength})` }}
      >
        <div
          className="absolute inset-0"
          style={{
            filter: "blur(70px) saturate(1.15)",
            background: `
              radial-gradient(28% 22% at 22% 72%, rgb(59 75 220 / 0.95), transparent 70%),
              radial-gradient(26% 24% at 38% 60%, rgb(122 79 224 / 0.9), transparent 70%),
              radial-gradient(30% 26% at 58% 46%, rgb(255 79 154 / 0.95), transparent 70%),
              radial-gradient(22% 20% at 70% 32%, rgb(255 111 200 / 0.85), transparent 70%),
              radial-gradient(16% 14% at 46% 82%, rgb(245 161 74 / 0.9), transparent 70%),
              radial-gradient(14% 12% at 86% 20%, rgb(245 161 74 / 0.7), transparent 70%)
            `,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            animation: "blob 14s ease-in-out infinite",
            filter: "blur(50px)",
            background: "radial-gradient(18% 16% at 52% 54%, rgb(255 140 210 / 0.7), transparent 70%)",
          }}
        />
      </div>

      {accent && (
        <div
          key={accent}
          className="animate-flood absolute inset-0"
          style={{
            background: `radial-gradient(60% 55% at 50% 45%, ${accent}cc, transparent 72%)`,
            filter: "blur(40px)",
          }}
        />
      )}

      <div
        className="halftone absolute inset-0"
        style={{
          opacity: 0.55,
          maskImage: "radial-gradient(70% 60% at 60% 45%, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(70% 60% at 60% 45%, black 20%, transparent 75%)",
        }}
      />

      {waves && (
        <div className="absolute inset-x-0 bottom-0 h-[34vh] opacity-60">
          <Wave className="bottom-0 h-full" duration={38} opacity={0.35} offset={0} />
          <Wave className="bottom-0 h-[80%]" duration={26} opacity={0.4} offset={1} reverse />
          <Wave className="bottom-0 h-[55%]" duration={18} opacity={0.55} offset={2} />
        </div>
      )}

      {pixels && <PixelBlocks />}

      <div className="grain absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_10%,transparent_40%,var(--vignette)_100%)]" />
    </div>
  );
}

const WAVE_GRADIENTS = [
  ["#3b4bdc", "#7a4fe0", "#ff4f9a"],
  ["#7a4fe0", "#ff4f9a", "#f5a14a"],
  ["#ff4f9a", "#ff6fc8", "#3b4bdc"],
];

function Wave({
  className,
  duration,
  opacity,
  offset,
  reverse,
}: {
  className: string;
  duration: number;
  opacity: number;
  offset: number;
  reverse?: boolean;
}) {
  const id = `wave-${offset}`;
  const [a, b, c] = WAVE_GRADIENTS[offset % WAVE_GRADIENTS.length];
  const path =
    "M0 60 C150 20 300 20 450 60 C600 100 750 100 900 60 C1050 20 1200 20 1350 60 C1500 100 1650 100 1800 60 L1800 200 L0 200 Z";
  return (
    <div className={`absolute left-0 w-[200%] ${className}`} style={{ opacity }}>
      <svg
        viewBox="0 0 1800 200"
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ animation: `wave ${duration}s linear infinite ${reverse ? "reverse" : ""}` }}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={a} />
            <stop offset="50%" stopColor={b} />
            <stop offset="100%" stopColor={c} />
          </linearGradient>
          <linearGradient id={`${id}-fade`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${id}-mask`}>
            <rect width="1800" height="200" fill={`url(#${id}-fade)`} />
          </mask>
        </defs>
        <path d={path} fill={`url(#${id})`} mask={`url(#${id}-mask)`} />
      </svg>
    </div>
  );
}

const PIXELS: [number, number, string][] = [
  [0, 0, "#3b4bdc"],
  [1, 0, "#5a4fe0"],
  [0, 1, "#3b4bdc"],
  [0, 2, "#7a4fe0"],
  [1, 1, "#3b4bdc"],
  [2, 0, "#7a4fe0"],
  [0, 3, "#5a4fe0"],
  [1, 2, "#7a4fe0"],
];

function PixelBlocks() {
  const size = 22;
  const blocks = (flip: boolean) =>
    PIXELS.map(([x, y, color], i) => (
      <div
        key={i}
        className="absolute"
        style={{
          width: size,
          height: size,
          [flip ? "right" : "left"]: x * size,
          [flip ? "bottom" : "top"]: y * size,
          background: color,
          opacity: 0.85 - i * 0.07,
        }}
      />
    ));
  return (
    <>
      <div className="absolute left-0 top-24 h-28 w-20">{blocks(false)}</div>
      <div className="absolute bottom-24 right-0 h-28 w-20">{blocks(true)}</div>
    </>
  );
}
