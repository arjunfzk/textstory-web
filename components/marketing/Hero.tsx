/**
 * Hero section for the TextStory landing page.
 * Includes top NavBar, headline copy with dual CTAs, and a decorative
 * CSS-only phone mockup showing a fake iMessage conversation.
 */
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden" style={{ background: "#131313" }}>
      {/* ── NavBar ─────────────────────────────────────────── */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-jakarta)", color: "#ffd13d" }}
        >
          TextStory
        </Link>

        <div className="flex items-center gap-8">
          <Link href="#features" className="text-sm" style={{ color: "#d2c5ad" }}>Features</Link>
          <Link href="/editor" className="text-sm" style={{ color: "#d2c5ad" }}>Editor</Link>
          <Link
            href="/editor"
            className="rounded-full px-5 py-2 text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #ffd13d, #e2b500)", color: "#3d2f00" }}
          >
            Start Exporting
          </Link>
        </div>
      </nav>

      {/* ── Hero Content ───────────────────────────────────── */}
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-16 pb-12 text-center">
        {/* Badge */}
        <span
          className="mb-6 inline-block rounded-full px-4 py-1.5 text-xs font-medium tracking-wide"
          style={{ background: "#2a2a2a", color: "#d2c5ad" }}
        >
          Simulated Screen Recording Pro
        </span>

        {/* Headline */}
        <h1
          className="max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          style={{ fontFamily: "var(--font-jakarta)", color: "#e5e2e1" }}
        >
          Create Realistic{" "}
          <span className="italic" style={{ color: "#ffd13d" }}>Texting Simulations</span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "#d2c5ad" }}>
          Write a script, pick a chat style, and export a pixel-perfect screen recording
          with realistic typing animations. Ready for TikTok, Reels, and YouTube Shorts.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/editor"
            className="rounded-full px-7 py-3 text-base font-bold"
            style={{ background: "linear-gradient(135deg, #ffd13d, #e2b500)", color: "#3d2f00" }}
          >
            Create Your First Story
          </Link>
          <Link
            href="#showcase"
            className="rounded-full px-7 py-3 text-base font-semibold"
            style={{ border: "1.5px solid #4e4634", color: "#d2c5ad" }}
          >
            View Sample Exports
          </Link>
        </div>
      </div>

      {/* ── Phone Mockup ──────────────────────────────────── */}
      <div className="relative mx-auto flex justify-center px-6 pb-24">
        {/* Ambient gold glow */}
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: 340, height: 340, background: "radial-gradient(circle, rgba(255,209,61,0.12) 0%, transparent 70%)" }}
        />

        <div
          className="relative flex flex-col overflow-hidden rounded-[3rem] border-[12px]"
          style={{ width: 220, height: 460, borderColor: "#353534", background: "#000" }}
        >
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[10px] font-medium" style={{ color: "#888" }}>
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span>&#9679;&#9679;&#9679;&#9679;</span>
            </span>
          </div>

          {/* Contact header */}
          <div className="flex flex-col items-center pb-2">
            <span className="text-xs font-semibold" style={{ color: "#e5e2e1" }}>Creative Director</span>
            <span className="text-[9px]" style={{ color: "#4e4634" }}>Online</span>
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col justify-end gap-1.5 px-3 pb-2">
            {/* Received */}
            <div className="flex justify-start">
              <span className="inline-block max-w-[75%] rounded-2xl px-3 py-1.5 text-[12px]" style={{ background: "#201f1f", color: "#e5e2e1", borderBottomLeftRadius: 4 }}>
                The campaign deck is ready
              </span>
            </div>
            {/* Sent */}
            <div className="flex justify-end">
              <span className="inline-block max-w-[75%] rounded-2xl px-3 py-1.5 text-[12px] font-medium" style={{ background: "#ffd13d", color: "#3d2f00", borderBottomRightRadius: 4 }}>
                Send it over!
              </span>
            </div>
            {/* Received */}
            <div className="flex justify-start">
              <span className="inline-block max-w-[75%] rounded-2xl px-3 py-1.5 text-[12px]" style={{ background: "#201f1f", color: "#e5e2e1", borderBottomLeftRadius: 4 }}>
                You&apos;re going to love it
              </span>
            </div>

            {/* Typing indicator */}
            <div className="flex justify-start">
              <span className="inline-flex items-center gap-[3px] rounded-2xl px-3 py-1.5" style={{ background: "#201f1f" }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block h-[5px] w-[5px] rounded-full"
                    style={{ background: "#888", animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </span>
            </div>
          </div>

          {/* Composer bar */}
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: "1px solid #1c1b1b" }}>
            <div className="flex-1 rounded-full py-1 px-3 text-[10px]" style={{ background: "#1c1b1b", color: "#4e4634" }}>
              iMessage
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "#ffd13d" }}>
              <span className="text-[10px]" style={{ color: "#3d2f00" }}>&#9650;</span>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframes for typing dots */}
      <style>{`
        @keyframes pulse {
          0%, 60%, 100% { opacity: .25; transform: scale(.85); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  );
}
