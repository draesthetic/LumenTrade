import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "LumenTrade — Premium Trade Intelligence",
  description: "A premium modern trade analysis platform with liquid glass visuals, elite analytics, and real-time insight.",
  metadataBase: new URL("https://lumentrade.example"),
  openGraph: {
    title: "LumenTrade — Premium Trade Intelligence",
    description: "Luxury-grade trade analysis with liquid glass design and performance-grade analytics.",
    url: "https://lumentrade.example",
    siteName: "LumenTrade",
    images: [
      {
        url: "https://lumentrade.example/og.png",
        width: 1200,
        height: 630,
        alt: "LumenTrade"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "LumenTrade — Premium Trade Intelligence",
    description: "Luxury-grade trade analysis with liquid glass design and performance-grade analytics.",
    images: ["https://lumentrade.example/og.png"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={dmSans.className}>{children}</body>
    </html>
  );
}
