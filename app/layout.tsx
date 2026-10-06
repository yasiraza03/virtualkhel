import type { Metadata, Viewport } from "next";
import { Anton, Inter, JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const notoSc = Noto_Sans_SC({ weight: ["700", "900"], variable: "--font-noto-sc", display: "swap", preload: false });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "VIRTUALKHEL — Game Constellation",
  description:
    "Explore the universe of video games as a navigable 3D galaxy. A deterministic Game DNA engine and Taste Reactor connect games by verified metadata and inferred similarity.",
  applicationName: "VIRTUALKHEL",
};

export const viewport: Viewport = {
  themeColor: "#080611",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${notoSc.variable} ${jetbrains.variable} ${inter.variable}`} data-stage="awaken">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
