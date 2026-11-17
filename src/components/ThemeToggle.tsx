import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("veyro-theme") === "dark"; }
    catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("veyro-theme", dark ? "dark" : "light"); } catch { /* storage may be unavailable */ }
  }, [dark]);

  return (
    <button className="theme-toggle" onClick={() => setDark(value => !value)} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
