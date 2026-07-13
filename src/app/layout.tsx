import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import { Header } from "@/components/layout/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "OceanScope",
  description: "现代国际物流可视化平台基础框架",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-ocean-50 antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
