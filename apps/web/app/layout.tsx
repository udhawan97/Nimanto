import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { ServiceWorker } from "../components/service-worker.js";

const publicBase =
  process.env.NIMANTO_GITHUB_PAGES === "true" ? "https://udhawan97.github.io/Nimanto" : "";

export const metadata: Metadata = {
  metadataBase: new URL("https://udhawan97.github.io/Nimanto/"),
  title: { default: "Nimanto — evidence-first job search", template: "%s · Nimanto" },
  description:
    "A private, candidate-controlled evidence and application workbench for H-1B professionals.",
  applicationName: "Nimanto",
  referrer: "no-referrer",
  manifest: `${publicBase}/manifest.webmanifest`,
  /* No hand-written `icons` entry. The tab icon comes from app/icon.svg via the
   * Next file convention, which emits a basePath-correct href on its own — the
   * previous literal "/assets/icon.svg" was root-absolute, so under the
   * /Nimanto/ base path it 404'd and browsers fell back to their default mark. */
  openGraph: {
    title: "Nimanto — evidence-first job search",
    description:
      "Build a verified career record, understand role fit, and approve every application handoff.",
    type: "website",
    images: [
      {
        url: "https://udhawan97.github.io/Nimanto/assets/social-card.png",
        width: 1200,
        height: 630,
        alt: "Nimanto — the invitation fold, beside the words evidence first, applications second",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Ink. The browser chrome should not be the one bright thing on the screen.
  themeColor: "#0A0908",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
