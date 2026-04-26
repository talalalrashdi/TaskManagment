import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { RootFrame } from "@/components/layout/root-frame";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechFlow PM",
  description: "Internal project management platform for technical teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        <Providers>
          <RootFrame>{children}</RootFrame>
        </Providers>
      </body>
    </html>
  );
}
