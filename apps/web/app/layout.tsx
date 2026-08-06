import type { Metadata, Viewport } from "next";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/space-grotesk";
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
  icons: { icon: `${publicBase}/assets/icon.svg` },
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
        alt: "Nimanto evidence-first job search",
      },
    ],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4f7fc" };

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
