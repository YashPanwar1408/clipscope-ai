"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function ComparisonRetryButton({ comparisonId }: { comparisonId: string }) {
  const router = useRouter();
  const [retrying, setRetrying] = React.useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      const response = await fetch(`/api/comparisons/${comparisonId}/retry`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Could not retry comparison analysis");
      toast({ title: "Comparison analysis queued" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Could not retry comparison",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={() => void retry()} disabled={retrying}>
      {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      Retry analysis
    </Button>
  );
}
