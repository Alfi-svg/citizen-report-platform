import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";

import AndroidLifecycleProvider from "@/components/AndroidLifecycleProvider";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://citizenreport.gov.bd";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "NIRAPOTTA | নিরাপত্তা — Citizen Safety Platform",
    template: "%s | NIRAPOTTA",
  },
  description:
    "Citizen-powered safety platform for reporting civic hazards, emergency alerts, missing persons, and blood requests with verifiable evidence across Bangladesh.",
  icons: {
    icon: "/brand/logo-icon.jpg",
    apple: "/brand/logo-icon.jpg",
  },
  openGraph: {
    title: "NIRAPOTTA | নিরাপত্তা — Citizen Safety Platform",
    description:
      "Citizen-powered safety platform for reporting civic hazards, emergency alerts, missing persons, and blood requests with verifiable evidence across Bangladesh.",
    url: APP_URL,
    siteName: "NIRAPOTTA",
    locale: "en_BD",
    type: "website",
    images: [
      {
        url: "/brand/logo.jpg",
        width: 1024,
        height: 1024,
        alt: "NIRAPOTTA Emblem",
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
          <AndroidLifecycleProvider>
            <Navbar />
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            <Footer />
            <MobileBottomNav />
          </AndroidLifecycleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
