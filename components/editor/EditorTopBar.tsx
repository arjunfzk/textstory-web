/**
 * Editor top bar — Obsidian Gold design.
 *
 * Fixed at top, 80px tall with gold branding, centered nav links,
 * and right-side auth controls. Background shift instead of border.
 */

'use client';

import Link from 'next/link';

const NAV_LINKS = [
  { label: 'Features', href: '/features' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Editor', href: '/editor' },
] as const;

export function EditorTopBar() {
  return (
    <div className="flex items-center justify-between px-6 shrink-0 select-none h-20 bg-[#1c1b1b]">
      {/* Left — Logo */}
      <Link
        href="/"
        className="text-2xl font-black tracking-tighter text-[#ffd13d] no-underline"
        style={{ fontFamily: 'var(--font-jakarta)' }}
      >
        TextStory
      </Link>

      {/* Center — Nav links */}
      <nav className="hidden md:flex items-center gap-8">
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = label === 'Editor';
          return (
            <Link
              key={label}
              href={href}
              className={`text-sm font-medium no-underline transition-colors ${
                isActive
                  ? 'text-[#ffd13d] border-b-2 border-[#ffd13d] pb-1'
                  : 'text-[#d2c5ad] hover:text-[#e5e2e1]'
              }`}
              style={{ fontFamily: 'var(--font-inter)' }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right — Auth controls */}
      <div className="flex items-center gap-4">
        <button
          className="text-sm font-medium text-[#d2c5ad] hover:text-[#e5e2e1] transition-colors cursor-pointer bg-transparent border-none"
          style={{ fontFamily: 'var(--font-inter)' }}
        >
          Login
        </button>
        <button
          className="px-5 py-2.5 rounded-full font-bold text-sm text-[#3d2f00] bg-gradient-to-r from-[#ffd13d] to-[#e2b500] hover:brightness-110 transition-all cursor-pointer border-none"
          style={{ fontFamily: 'var(--font-inter)' }}
        >
          Start Directing
        </button>
      </div>
    </div>
  );
}
