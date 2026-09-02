import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bangladesh Citizen Report Platform",
  description: "Citizen reporting platform for community incident reports and evidence submission.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
