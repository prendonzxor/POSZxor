import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS Zxor Admin",
  description: "Acceso tecnico y administrativo de POS Zxor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
