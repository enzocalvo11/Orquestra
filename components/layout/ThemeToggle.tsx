"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

const themeKey = "orquestra-theme";

export function ThemeToggle() {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(themeKey);
    document.documentElement.dataset.theme = savedTheme === "dark" ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(themeKey, nextTheme);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Alternar entre modo claro e modo escuro"
      title="Alternar tema"
    >
      <span className="theme-icon-light"><Sun size={17} aria-hidden="true" /></span>
      <span className="theme-icon-dark"><Moon size={17} aria-hidden="true" /></span>
    </button>
  );
}
