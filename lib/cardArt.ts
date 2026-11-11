/** Shared look for the generated images (link preview, results card). Satori needs explicit sizes, not `inset`. */
export const WASHES = [
  "radial-gradient(ellipse at 100% 0%, rgba(255,79,154,0.95) 0%, rgba(255,111,200,0.5) 30%, transparent 62%)",
  "radial-gradient(ellipse at 0% 100%, rgba(59,75,220,0.95) 0%, rgba(122,79,224,0.55) 32%, transparent 64%)",
  "radial-gradient(ellipse at 100% 100%, rgba(245,161,74,0.8) 0%, rgba(255,79,154,0.3) 28%, transparent 50%)",
  "radial-gradient(ellipse at 0% 0%, rgba(122,79,224,0.35) 0%, transparent 45%)",
].join(", ");

export const HALFTONE = {
  backgroundImage: "radial-gradient(circle at center, rgba(22,18,17,0.75) 0%, rgba(22,18,17,0.75) 32%, transparent 48%)",
  backgroundSize: "6px 6px",
  backgroundRepeat: "repeat",
} as const;

export const LAYER = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" } as const;

export const INK = "#161211";
export const CREAM = "#fff7ea";
export const BRAND_GRADIENT = "linear-gradient(100deg, #ff7a6b 0%, #ff6fc8 45%, #f5a14a 100%)";
