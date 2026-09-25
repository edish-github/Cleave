# Image placeholders

The app uses two images, both on the landing page. Everything else (hero visual, How it works
art, auth panel, icons) is drawn in code and needs no files.

All image sources live in one file: `src/lib/assets.ts`. Components never hard-code a URL.

| Key in `assets.ts` | Where it shows | Size | What it should show |
| --- | --- | --- | --- |
| `landingStackScreenshot` | Landing, "Product" section, inside a browser frame | 2400 × 1500 PNG (16:10) | The stack overview for galaxium-travels #184 in the real app |
| `landingBobScreenshot` | Landing, "The AI can only move hunks" section | 1200 × 900 PNG (4:3) | Bob IDE in the ✂ Cleave mode, with the parallel explore subagents panel visible |

Both currently point to `placehold.co` images labelled with their name and size, so the
layout is final and nothing shifts when the real files arrive.

## Replace a placeholder

1. Save the file under `apps/web/public/images/`:
   - `landing-stack-overview.png`
   - `landing-bob-ide.png`
2. In `src/lib/assets.ts`, change `src` to the local path and keep `width`, `height` and `alt`
   in step with the file:

   ```ts
   landingStackScreenshot: {
     src: "/images/landing-stack-overview.png",
     width: 2400,
     height: 1500,
     alt: "Cleave stack overview showing five verified layers for a pull request",
   },
   ```

3. When no remote images are left, remove the `images.remotePatterns` entry for
   `placehold.co` in `next.config.ts`.

Keep the aspect ratios (16:10 and 4:3). The frames are sized for them.

## How to capture them

**Stack overview (2400 × 1500).** Capture the real page, not a mock:

1. `npm run build && npm start`, sign in, open `/app/stacks/galaxium-travels-184`.
2. Use a 1200 × 750 viewport at 2× device pixel ratio (Chrome DevTools device toolbar, or
   Playwright `viewport: { width: 1200, height: 750 }, deviceScaleFactor: 2`).
3. Light theme, reduce motion on (Settings → Appearance), so nothing is mid-animation.
4. Screenshot the viewport, not the full page.

**Bob IDE (1200 × 900).** Take it from a real ✂ Cleave run in Bob IDE, the same session you
save to `bob_sessions/`. Show the mode name, the subagents panel with 3–5 explore subagents,
and at least one `cleave_*` tool call. Crop to 4:3 and export at 1200 × 900. Hide anything
personal: account names, email, other projects, file paths outside the demo repo.

## Rules for any new image

- Add it to `src/lib/assets.ts` with `src`, `width`, `height` and a real `alt`.
- Only real screenshots of Cleave or Bob, no stock photos and no generated product art.
- No personal, client or social-media data in any image (hackathon data rules).
- Optional: a 1200 × 630 Open Graph image at `src/app/opengraph-image.png` gives shared
  links (including `/proof/…`) a preview card. Next.js picks it up with no code change.
