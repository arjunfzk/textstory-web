/**
 * Feature bento grid showcasing TextStory's key capabilities.
 * Asymmetric 3-column layout with large and small cards using
 * the Obsidian Gold design system.
 */
import Link from "next/link";

/** Checkmark icon rendered inline. */
function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd13d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Small stat badge with gold text. */
function StatBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold tracking-wide"
      style={{ background: "rgba(255,209,61,0.1)", color: "#ffd13d", border: "1px solid rgba(78,70,52,0.3)" }}
    >
      {label}
    </span>
  );
}

export function StyleShowcase() {
  return (
    <section id="features" className="px-5 py-20">
      {/* Section label pill */}
      <div className="mx-auto mb-8 flex max-w-5xl justify-center">
        <span
          className="inline-block rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ color: "#ffd13d", border: "1px solid #4e4634" }}
        >
          Simulation Engine
        </span>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">

        {/* ── Large card: Customizable Chat Bubbles (spans 2 cols) ── */}
        <div
          className="flex flex-col justify-between rounded-[2rem] p-8 md:col-span-2"
          style={{ background: "#1c1b1b", border: "1px solid rgba(78,70,52,0.1)" }}
        >
          <div>
            {/* Card label tag */}
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "#ffd13d", border: "1px solid #4e4634" }}
            >
              Simulation Engine
            </span>
            <h3
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ fontFamily: "var(--font-jakarta)", color: "#e5e2e1" }}
            >
              Customizable Chat Bubbles &amp; Skins
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed" style={{ color: "#d2c5ad" }}>
              Choose from iMessage, WhatsApp, and Instagram chat styles.
              Every detail — bubble shape, font, spacing — matches the real thing.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm" style={{ color: "#e5e2e1" }}>
              <Check /> Pixel-perfect UI replications
            </span>
            <span className="flex items-center gap-2 text-sm" style={{ color: "#e5e2e1" }}>
              <Check /> Dynamic Dark/Light Mode support
            </span>
          </div>
        </div>

        {/* ── Small card: Realistic Typing ── */}
        <div
          className="flex flex-col rounded-[2rem] p-8"
          style={{ background: "#2a2a2a", border: "1px solid rgba(78,70,52,0.1)" }}
        >
          {/* Typing dots icon */}
          <div
            className="mb-3 inline-flex w-fit items-center gap-[4px] rounded-full px-3 py-1.5"
            style={{ background: "rgba(255,209,61,0.1)" }}
          >
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#ffd13d", opacity: 0.5 }} />
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#ffd13d", opacity: 0.8 }} />
            <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#ffd13d" }} />
          </div>
          <h3
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-jakarta)", color: "#e5e2e1" }}
          >
            Realistic Typing
          </h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#d2c5ad" }}>
            Animated typing indicators and variable keystroke timing that
            mimics real human texting patterns.
          </p>
        </div>

        {/* ── Small card: Screen Recording Export ── */}
        <div
          className="flex flex-col rounded-[2rem] p-8"
          style={{ background: "#2a2a2a", border: "1px solid rgba(78,70,52,0.1)" }}
        >
          {/* Video camera icon */}
          <div className="mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffd13d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="13" height="12" rx="2" />
              <path d="M15 10l5-3v10l-5-3" />
            </svg>
          </div>
          <h3
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-jakarta)", color: "#e5e2e1" }}
          >
            Screen Recording Export
          </h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#d2c5ad" }}>
            Export a simulated screen recording as an MP4 video.
            No buggy phone recorders needed.
          </p>
        </div>

        {/* ── Bottom card: Export in Seconds (spans 2 cols) ── */}
        <div
          className="flex flex-col items-start justify-between gap-6 rounded-[2rem] p-8 sm:flex-row sm:items-center md:col-span-2"
          style={{ background: "#1c1b1b", border: "1px solid rgba(78,70,52,0.1)" }}
        >
          <div>
            <h3
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-jakarta)", color: "#e5e2e1" }}
            >
              Export in Seconds
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "#d2c5ad" }}>
              One-click export with server-side rendering. Your video is ready
              before you finish your coffee.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <StatBadge label="60 FPS" />
              <StatBadge label="4K HDR" />
            </div>
          </div>

          <Link
            href="/editor"
            className="shrink-0 rounded-full px-6 py-3 text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #ffd13d, #e2b500)", color: "#3d2f00" }}
          >
            Start Exporting Free
          </Link>
        </div>
      </div>
    </section>
  );
}
