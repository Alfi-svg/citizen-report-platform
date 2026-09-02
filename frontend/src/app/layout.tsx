import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://citizenreport.gov.bd";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Bangladesh Citizen Report Platform | নাগরিক প্রতিবেদন প্ল্যাটফর্ম",
    template: "%s | Bangladesh Citizen Report Platform",
  },
  description:
    "Citizen-powered platform for reporting civic hazards, infrastructure issues, and environmental violations with verifiable evidence across Bangladesh.",
  openGraph: {
    title: "Bangladesh Citizen Report Platform | নাগরিক প্রতিবেদন প্ল্যাটফর্ম",
    description:
      "Citizen-powered platform for reporting civic hazards, infrastructure issues, and environmental violations with verifiable evidence across Bangladesh.",
    url: APP_URL,
    siteName: "Bangladesh Citizen Report Platform",
    locale: "en_BD",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
