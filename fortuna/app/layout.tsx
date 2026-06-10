import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fortuna - Solana Devnet Lottery",
  description:
    "Single-page Solana Devnet lottery demo powered by MagicBlock VRF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
