import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";

import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cater · Live injury intake",
  description: "A multilingual voice intake workspace for personal injury firms.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={atkinson.variable}>{children}</body>
    </html>
  );
}
