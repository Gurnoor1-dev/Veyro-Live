import type { PointerEvent } from "react";
import { Link, useLocation } from "react-router-dom";

export interface NavItem {
  label: string;
  href: string;
}

export interface SpotlightNavbarProps {
  items: NavItem[];
  className?: string;
  activeHref?: string;
  orientation?: "horizontal" | "vertical";
  onItemClick?: (item: NavItem, index: number) => void;
}

export default function SpotlightNavbar({
  items,
  className = "",
  activeHref,
  orientation = "horizontal",
  onItemClick,
}: SpotlightNavbarProps) {
  const location = useLocation();
  const active = activeHref ?? location.pathname;

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = orientation === "vertical"
      ? event.clientY - rect.top
      : event.clientX - rect.left;
    event.currentTarget.style.setProperty("--spotlight-position", position + "px");
    event.currentTarget.style.setProperty("--spotlight-opacity", "1");
  };

  const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--spotlight-opacity", "0");
  };

  return (
    <nav
      className={["spotlight-nav", "spotlight-nav-" + orientation, className].filter(Boolean).join(" ")}
      aria-label="Dashboard navigation"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <span className="spotlight-nav-light" aria-hidden="true" />
      {items.map((item, index) => {
        const isActive = active === item.href || (item.href !== "/" && active.startsWith(item.href + "/"));
        const content = <span>{item.label}</span>;
        if (onItemClick) {
          return (
            <a
              key={item.href}
              href={item.href}
              className={"spotlight-nav-item" + (isActive ? " active" : "")}
              aria-current={isActive ? "page" : undefined}
              onClick={event => { event.preventDefault(); onItemClick(item, index); }}
            >
              {content}
            </a>
          );
        }
        return (
          <Link
            key={item.href}
            to={item.href}
            className={"spotlight-nav-item" + (isActive ? " active" : "")}
            aria-current={isActive ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
