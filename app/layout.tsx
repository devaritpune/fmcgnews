import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FMCGDesk Market Intelligence",
  description: "Executive News Bulletin & Geospatial Trade Intelligence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}