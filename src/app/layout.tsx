import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "live-board",
  description: "Real-time collaborative whiteboard powered by Yjs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
