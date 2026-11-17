import { Link } from "react-router-dom";

export default function Brand() {
  return (
    <>
      <svg className="theme-filter-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="if-live-light-filter" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.2126 0.7152 0.0722 0 0" result="luminanceMask" />
            <feComponentTransfer in="luminanceMask" result="whiteMask">
              <feFuncA type="linear" slope="10" intercept="-8" />
            </feComponentTransfer>
            <feFlood floodColor="#0f172a" result="darkInk" />
            <feComposite in="darkInk" in2="whiteMask" operator="in" result="recoloredWhite" />
            <feComposite in="recoloredWhite" in2="SourceGraphic" operator="over" />
          </filter>
        </defs>
      </svg>
      <Link className="brand" to="/" aria-label="Veyro Live home">
        <img className="brand-image" src="/images/veyro-live.png" alt="Veyro Live" />
      </Link>
    </>
  );
}
