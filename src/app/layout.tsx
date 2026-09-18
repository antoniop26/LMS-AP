import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tigers LMS — Smart Academy Panama",
  description: "Sistema de gestión de aprendizaje escolar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
