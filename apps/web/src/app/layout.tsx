import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { title: site.name, description: site.description, siteName: site.name, type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#f8f7f4",
};

/**
 * Applies the saved theme and motion preference before first paint.
 * Only the authenticated app reads data-theme; marketing pages are always light.
 */
const preferenceScript = `(function(){try{var d=document.documentElement,t=localStorage.getItem("cleave-theme")||"light",dark=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);d.dataset.theme=dark?"dark":"light";if(localStorage.getItem("cleave-motion")==="reduce")d.dataset.motion="reduce";}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
