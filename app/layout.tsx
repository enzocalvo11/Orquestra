import type { Metadata } from "next";
import "./globals.css";
import "../features/overview/overview.css";
import "../features/planning/planning.css";
import "./theme.css";

export const metadata: Metadata = {
  title: "Orquestra | Gestão empresarial",
  description: "Timelines, capacidade e decisões de alocação entre projetos.",
  icons: {
    icon: "/orquestra-favicon-v2.png",
    shortcut: "/orquestra-favicon-v2.png",
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
