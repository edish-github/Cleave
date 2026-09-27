/**
 * Every image the frontend uses, in one place.
 * Placeholder URLs point at placehold.co. Replace each `src` with a file in
 * /public/images (see ASSETS.md) and keep the same width/height ratio.
 */
export const assets = {
  landingStackScreenshot: {
    src: "/images/landing-stack-overview.png",
    width: 2940,
    height: 1912,
    alt: "Cleave stack overview showing verified layers for a pull request",
  },
  landingBobScreenshot: {
    src: "https://placehold.co/1200x900/F2F1ED/85858E/png?text=Bob+IDE+%E2%80%94+Cleave+mode%0A1200+%C3%97+900",
    width: 1200,
    height: 900,
    alt: "IBM Bob IDE running the Cleave mode with parallel subagents",
  },
} as const;
