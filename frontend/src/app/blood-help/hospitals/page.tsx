"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HospitalRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect cleanly to /blood-help with hospital tab active
    router.replace("/blood-help?tab=hospitals");
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="animate-pulse text-zinc-500 text-sm font-semibold">
        Loading Hospital & Blood Stock Finder...
      </div>
    </div>
  );
}
