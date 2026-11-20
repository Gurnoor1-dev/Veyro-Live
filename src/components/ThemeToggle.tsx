import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button as ChakraButton } from "@chakra-ui/react";

function getInitialTheme(): boolean {
  try {
    const stored = localStorage.getItem("veyro-theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    // Storage can be unavailable in private browsing contexts.
  }
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem("veyro-theme", dark ? "dark" : "light");
    } catch {
      // The selected theme still works for this session without storage.
    }
  }, [dark]);

  return (
    <ChakraButton
      className="theme-toggle"
      type="button"
      onClick={() => setDark((value) => !value)}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={dark}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </ChakraButton>
  );
}
