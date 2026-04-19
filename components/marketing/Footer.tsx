/**
 * Footer with a full-width gold gradient CTA card and
 * minimal link row below.
 */
import Link from "next/link";

export function Footer() {
  return (
    <footer>
      {/* ── Full-width CTA ─────────────────────────────────── */}
      <div className="px-5 py-16">
        <div
          className="mx-auto flex max-w-4xl flex-col items-center gap-6 rounded-[3rem] px-8 py-16 text-center"
          style={{ background: "linear-gradient(135deg, #ffd13d, #e2b500)" }}
        >
          <h2
            className="text-3xl font-extrabold tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-jakarta)", color: "#3d2f00" }}
          >
            Ready to record?
          </h2>
          <p className="max-w-md text-base" style={{ color: "#3d2f00", opacity: 0.8 }}>
            Write your script, pick a style, and export a pixel-perfect
            screen recording in seconds. No account needed.
          </p>
          <Link
            href="/editor"
            className="rounded-full px-8 py-4 text-sm font-extrabold uppercase tracking-widest"
            style={{ background: "#131313", color: "#ffd13d" }}
          >
            START YOUR STORY NOW
          </Link>
        </div>
      </div>

      {/* ── Footer links ───────────────────────────────────── */}
      <div
        className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:justify-between"
        style={{ borderTop: "1px solid #3a3939" }}
      >
        <div className="flex flex-col items-center sm:items-start">
          <span
            className="text-base font-bold tracking-tight"
            style={{ fontFamily: "var(--font-jakarta)", color: "#ffd13d" }}
          >
            TextStory
          </span>
          <span className="text-[10px] uppercase tracking-widest" style={{ color: "#4e4634" }}>
            High-Fidelity Simulations
          </span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/editor" className="text-xs" style={{ color: "#d2c5ad" }}>Editor</Link>
        </div>

        <p className="text-xs" style={{ color: "#4e4634" }}>
          &copy; 2026 TextStory. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
