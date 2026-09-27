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
    src: "/images/landing-bob.png",
    width: 2940,
    height: 1912,
    alt: "IBM Bob IDE running the Cleave mode with parallel subagents and verified layers",
  },
} as const;
