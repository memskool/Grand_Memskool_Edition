import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "memskool-theme";

type Theme = "light" | "dark";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function readTheme(): Theme {
  const stored = window.localStorage.getItem(KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type ThemeValue = { theme: Theme; toggle: () => void; setTheme: (next: Theme) => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === "undefined"
      ? "light"
      : document.documentElement.classList.contains("dark")
        ? "dark"
        : "light",
  );

  useEffect(() => {
    const next = readTheme();
    setThemeState(next);
    apply(next);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(KEY, next);
    apply(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return {
    theme: "light",
    toggle: () => undefined,
    setTheme: () => undefined,
  };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="relative size-11 shrink-0 rounded-full text-foreground hover:bg-secondary"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun className="size-[18px] rotate-0 scale-100 transition-transform duration-300 ease-out dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-[18px] rotate-90 scale-0 transition-transform duration-300 ease-out dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
