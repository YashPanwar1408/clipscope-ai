"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="theme-toggle h-9 w-9 border border-white/[0.09] bg-white/[0.025] text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={isLight}
      title={label}
    >
      {isLight ? <Moon aria-hidden="true" className="h-4 w-4" /> : <Sun aria-hidden="true" className="h-4 w-4" />}
    </Button>
  );
}
