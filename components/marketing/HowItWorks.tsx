/**
 * Testimonials section replacing the original "How it Works" flow.
 * Three creator testimonials with avatar placeholders and gold accents.
 */

const TESTIMONIALS = [
  {
    name: "Marcus V.",
    title: "TikTok Influencer",
    quote:
      "The iMessage theme is indistinguishable from the real thing. My viewers actually think they\u2019re watching a real chat.",
    color: "#e2b500",
  },
  {
    name: "Elena S.",
    title: "Content Strategist",
    quote:
      "The simulated recording export is a life-saver. No more buggy phone recorders or cropping issues.",
    color: "#ffd13d",
  },
  {
    name: "David K.",
    title: "Digital Producer",
    quote:
      "Simple, powerful, and pixel-perfect. The typing animations add that human touch that makes stories go viral.",
    color: "#d2c5ad",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="px-5 py-20" style={{ background: "#0e0e0e" }}>
      <h2
        className="mb-14 text-center text-3xl font-bold tracking-tight sm:text-4xl"
        style={{ fontFamily: "var(--font-jakarta)", color: "#e5e2e1" }}
      >
        Creators Love the Realism
      </h2>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            className="flex flex-col items-center rounded-[2rem] p-8 text-center"
            style={{ background: "#1c1b1b" }}
          >
            {/* Avatar placeholder */}
            <div
              className="mb-5 flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold"
              style={{
                background: "#2a2a2a",
                border: `2px solid ${t.color}`,
                color: t.color,
              }}
            >
              {t.name.charAt(0)}
            </div>

            <p className="mb-6 flex-1 text-sm italic leading-relaxed" style={{ color: "#d2c5ad" }}>
              &ldquo;{t.quote}&rdquo;
            </p>

            <span className="text-sm font-semibold" style={{ color: "#ffd13d" }}>{t.name}</span>
            <span className="mt-0.5 text-xs uppercase tracking-widest" style={{ color: "#4e4634" }}>
              {t.title}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
