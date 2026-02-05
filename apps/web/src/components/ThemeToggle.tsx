"use client";

import { Button } from "./Button";
import { useTheme } from "@/providers/ThemeProvider";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const icon = theme === "light" ? <Sun /> : <Moon />;
  const label = theme === "light" ? "Light" : "Dark";

  return (
    <Button
      variant="outline"
      size="sm"
      icon={icon}
      onClick={toggleTheme}
      title={`Theme: ${label}. Click to toggle.`}
    >
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
