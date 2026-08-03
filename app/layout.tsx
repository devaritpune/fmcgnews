import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FMCGDesk | Spices & CPG Market Intelligence",
  description: "Real-time FMCG & Spices Regional News & Intelligence Dashboard",
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