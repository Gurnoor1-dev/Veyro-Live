import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  globalCss: {
    '[data-state="open"]': {
      animationName: "veyro-fade-in, veyro-slide-up",
      animationDuration: "260ms",
      animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
    '[data-state="closed"]': {
      animationName: "veyro-fade-in",
      animationDirection: "reverse",
      animationDuration: "140ms",
      animationTimingFunction: "ease-in",
    },
    '[data-state="open"], [data-state="closed"]': {
      _motionReduce: {
        animationDuration: "1ms !important",
      },
    },
  },
  theme: {
    tokens: {
      fonts: {
        body: { value: "Inter, ui-sans-serif, system-ui, sans-serif" },
        heading: { value: "Inter, ui-sans-serif, system-ui, sans-serif" },
      },
      radii: {
        veyro: { value: "14px" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
