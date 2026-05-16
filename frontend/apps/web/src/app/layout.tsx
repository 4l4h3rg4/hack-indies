import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackIndie — CISO Virtual",
  description: "Plataforma de ciberseguridad proactiva y autónoma para PyMEs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
