import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayara - Solana Devnet Jackpot Draw",
  description:
    "Ticket-inspired Solana Devnet jackpot demo powered by MagicBlock VRF.",
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
