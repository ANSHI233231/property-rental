import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@gharsetu/shared";

export const metadata: Metadata = {
  title: `${APP_NAME} — Phase 0`,
  description:
    "GharSetu — Delhi-first property rental management platform. Phase 0 stub.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#F8F9FA",
          color: "#212121",
        }}
      >
        {children}
      </body>
    </html>
  );
}
