import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import Link from "next/link";
import "../paper.css";
import "./map.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: "Map — Human on the Podium",
  description:
    "Every analyzed record placed by meaning and coloured by how much of it reads as machine-written.",
};

export const viewport: Viewport = {
  themeColor: "#edf5f7",
  viewportFit: "cover",
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${newsreader.variable} paper-root map-root`}>
      <Link
        href="/"
        className="fixed left-5 top-4 z-50 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted-ink)] transition-colors hover:text-[var(--ink)] sm:left-8"
      >
        ← Back to app
      </Link>
      {children}
    </div>
  );
}
