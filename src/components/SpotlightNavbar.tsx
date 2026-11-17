import { useEffect, useRef, useState, useCallback, type PointerEvent } from "react";
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

  // Find the single most specific matching route (prevents Overview + subpage both matching)
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
      canScrollLeft: scrollLeft > 4,
      canScrollRight: scrollLeft + clientWidth < scrollWidth - 4,
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

      // Auto-scroll active item smoothly into view if partially clipped
      const navLeft = nav.scrollLeft;
      const navRight = navLeft + nav.clientWidth;
      const elLeft = activeEl.offsetLeft;
      const elRight = elLeft + activeEl.offsetWidth;

      if (elLeft < navLeft + 24) {
        nav.scrollTo({ left: Math.max(0, elLeft - 24), behavior: "smooth" });
      } else if (elRight > navRight - 24) {
        nav.scrollTo({ left: elRight - nav.clientWidth + 24, behavior: "smooth" });
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
    navRef.current?.scrollBy({ left: direction * 180, behavior: "smooth" });
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
      {orientation === "horizontal" && scrollState.canScrollLeft && (
        <button
          type="button"
          className="spotlight-scroll-cue left"
          onClick={() => scrollByAmount(-1)}
          aria-label="Scroll navigation left"
        >
          ‹
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
        {/* Cursor hover spotlight */}
        <span className="spotlight-nav-light" aria-hidden="true" />

        {/* Single gliding active glow + blue indicator line */}
        {indicator.ready && (
          <span
            className="spotlight-active-indicator"
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
            <span className="spotlight-active-glow" />
            <span className="spotlight-active-line" />
          </span>
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
                <span>{item.label}</span>
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
              <span>{item.label}</span>
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
          ›
        </button>
      )}
    </div>
  );
}
