import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Poppins, Inter } from "next/font/google";
import { APP_NAME } from "@gharsetu/shared";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "GharSetu — Delhi-first property rental management platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${poppins.variable} ${inter.variable}`}>
      <body className="bg-off-white text-slate font-inter text-base leading-relaxed m-0">
        {children}
      </body>
    </html>
  );
}
