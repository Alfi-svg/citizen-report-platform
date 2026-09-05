import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://citizenreport.gov.bd";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Bangladesh Citizen Report Platform | একসাথে গড়ি নিরাপদ বাংলাদেশ",
    template: "%s | Bangladesh Citizen Report Platform",
  },
  description:
    "Citizen-powered platform for reporting civic hazards, safety alerts, missing persons, and infrastructure issues with verifiable evidence across Bangladesh.",
  icons: {
    icon: "/brand/logo-icon.jpg",
    apple: "/brand/logo-icon.jpg",
  },
  openGraph: {
    title: "Bangladesh Citizen Report Platform | একসাথে গড়ি নিরাপদ বাংলাদেশ",
    description:
      "Citizen-powered platform for reporting civic hazards, safety alerts, and missing persons with verifiable evidence across Bangladesh.",
    url: APP_URL,
    siteName: "Bangladesh Citizen Report Platform",
    locale: "en_BD",
    type: "website",
    images: [
      {
        url: "/brand/logo.jpg",
        width: 1024,
        height: 1024,
        alt: "Bangladesh Citizen Report Emblem",
      },
    ],
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
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <Footer />
          <MobileBottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
