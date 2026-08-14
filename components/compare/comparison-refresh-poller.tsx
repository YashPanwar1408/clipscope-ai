"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export function ComparisonRefreshPoller({ active }: { active: boolean }) {
  const router = useRouter();

  React.useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(interval);
  }, [active, router]);

  return null;
}
