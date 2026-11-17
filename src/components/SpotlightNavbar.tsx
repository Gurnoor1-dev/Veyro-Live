import { useEffect, useRef, useState, useCallback, type PointerEvent } from "react";
import { Building2, CalendarDays, ClipboardList, LayoutDashboard, Plane, ShieldCheck, UserRound, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

function iconForNavLabel(label: string) {
  const value = label.toLowerCase();
  const props = { size: 15, strokeWidth: 1.8 };
  if (value.includes("overview")) return <LayoutDashboard {...props}/>;
  if (value.includes("profile") && value.includes("public")) return <Building2 {...props}/>;
  if (value.includes("pilot profile")) return <UserRound {...props}/>;
  if (value.includes("approval")) return <ShieldCheck {...props}/>;
  if (value.includes("schedule")) return <CalendarDays {...props}/>;
  if (value.includes("fleet")) return <Plane {...props}/>;
  if (value.includes("booking")) return <ClipboardList {...props}/>;
  if (value.includes("crew") || value.includes("pilot")) return <Users {...props}/>;
  return <Building2 {...props}/>;
}

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

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const [indicator, setIndicator] = useState<{
    offset: number;
    size: number;
    ready: boolean;
  }>({ offset: 0, size: 0, ready: false });

  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const activeIndex = (() => {
    let bestIndex = -1;
    let bestLength = -1;

    items.forEach((item, index) => {
      const exactMatch = active === item.href;
      const nestedMatch =
        item.href !== "/" &&
        active.startsWith(item.href.endsWith("/") ? item.href : `${item.href}/`);

      if ((exactMatch || nestedMatch) && item.href.length > bestLength) {
        bestIndex = index;
        bestLength = item.href.length;
      }
    });

    return bestIndex;
  })();

  const updateScrollIndicators = useCallback(() => {
    const nav = navRef.current;
    if (!nav || orientation === "vertical") return;

    const { scrollLeft, scrollWidth, clientWidth } = nav;
    setScrollState({
      canScrollLeft: scrollLeft > 6,
      canScrollRight: scrollLeft + clientWidth < scrollWidth - 6,
    });
  }, [orientation]);

  const updateIndicator = useCallback(() => {
    const activeEl = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    const nav = navRef.current;

    if (!activeEl || !nav) {
      setIndicator((prev) => ({ ...prev, ready: false }));
      return;
    }

    if (orientation === "vertical") {
      setIndicator({
        offset: activeEl.offsetTop,
        size: activeEl.offsetHeight,
        ready: true,
      });
    } else {
      setIndicator({
        offset: activeEl.offsetLeft,
        size: activeEl.offsetWidth,
        ready: true,
      });

      const navLeft = nav.scrollLeft;
      const navRight = navLeft + nav.clientWidth;
      const elLeft = activeEl.offsetLeft;
      const elRight = elLeft + activeEl.offsetWidth;

      if (elLeft < navLeft + 32) {
        nav.scrollTo({ left: Math.max(0, elLeft - 32), behavior: "smooth" });
      } else if (elRight > navRight - 32) {
        nav.scrollTo({ left: elRight - nav.clientWidth + 32, behavior: "smooth" });
      }
    }
  }, [activeIndex, orientation]);

  useEffect(() => {
    updateIndicator();
    updateScrollIndicators();
  }, [updateIndicator, updateScrollIndicators, items]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const observer = new ResizeObserver(() => {
      updateIndicator();
      updateScrollIndicators();
    });

    observer.observe(nav);
    window.addEventListener("resize", updateIndicator);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator, updateScrollIndicators]);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const position =
      orientation === "vertical"
        ? event.clientY - rect.top
        : event.clientX - rect.left + event.currentTarget.scrollLeft;

    event.currentTarget.style.setProperty("--spotlight-position", `${position}px`);
    event.currentTarget.style.setProperty("--spotlight-opacity", "1");
  };

  const handlePointerLeave = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--spotlight-opacity", "0");
  };

  const scrollByAmount = (direction: -1 | 1) => {
    navRef.current?.scrollBy({ left: direction * 200, behavior: "smooth" });
  };

  const wrapperClasses = [
    "spotlight-nav-shell",
    `spotlight-nav-shell-${orientation}`,
    scrollState.canScrollLeft ? "can-scroll-left" : "",
    scrollState.canScrollRight ? "can-scroll-right" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClasses}>
      {/* Outer ambient glow layer */}
      <div className="spotlight-shell-glow" aria-hidden="true" />

      {orientation === "horizontal" && scrollState.canScrollLeft && (
        <button
          type="button"
          className="spotlight-scroll-cue left"
          onClick={() => scrollByAmount(-1)}
          aria-label="Scroll navigation left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      )}

      <nav
        ref={navRef}
        className={`spotlight-nav spotlight-nav-${orientation}`}
        aria-label="Dashboard navigation"
        onScroll={updateScrollIndicators}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* Cursor proximity light */}
        <span className="spotlight-nav-light" aria-hidden="true" />

        {/* Liquid Glass Sliding Active Pill */}
        {indicator.ready && (
          <div
            className="spotlight-active-pill"
            aria-hidden="true"
            style={
              orientation === "vertical"
                ? {
                    transform: `translateY(${indicator.offset}px)`,
                    height: `${indicator.size}px`,
                  }
                : {
                    transform: `translateX(${indicator.offset}px)`,
                    width: `${indicator.size}px`,
                  }
            }
          >
            <div className="spotlight-pill-reflection" />
          </div>
        )}

        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const itemClass = `spotlight-nav-item${isActive ? " active" : ""}`;

          if (onItemClick) {
            return (
              <a
                key={item.href}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                href={item.href}
                className={itemClass}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onItemClick(item, index);
                }}
              >
                <span className="spotlight-item-icon" aria-hidden="true">{iconForNavLabel(item.label)}</span><span className="spotlight-item-label">{item.label}</span>
              </a>
            );
          }

          return (
            <Link
              key={item.href}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              to={item.href}
              className={itemClass}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="spotlight-item-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {orientation === "horizontal" && scrollState.canScrollRight && (
        <button
          type="button"
          className="spotlight-scroll-cue right"
          onClick={() => scrollByAmount(1)}
          aria-label="Scroll navigation right"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      )}
    </div>
  );
}
