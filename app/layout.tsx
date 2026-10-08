import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const thinSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-thin-serif" });
const serif = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display-serif",
});
const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL ?? "https://kashmoney.com"),
  title: "KASHMONEY",
  description: "Build trivia boards and play with phone buzzers.",
  openGraph: { title: "KASHMONEY", description: "Live trivia with phone buzzers. Grab your phone and buzz in." },
};

export const viewport: Viewport = {
  themeColor: "#161211",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${thinSerif.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
