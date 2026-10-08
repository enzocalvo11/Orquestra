import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orquestra | Capacidade e alocação",
  description: "Timelines, capacidade e decisões de alocação entre projetos.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
