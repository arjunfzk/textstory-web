/**
 * Landing page — marketing page for TextStory Web.
 *
 * Server Component with zero client JS. Links to /editor for the app.
 * Sections: Hero (with nav), StyleShowcase (bento grid), HowItWorks (testimonials), Footer (CTA + links).
 */

import type { Metadata } from 'next';
import { Hero } from '@/components/marketing/Hero';
import { StyleShowcase } from '@/components/marketing/StyleShowcase';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'TextStory — Turn Fake Texts into Viral Videos',
  description:
    'Create iMessage, WhatsApp, and Instagram text conversations and export them as MP4 videos with typing animations and sound effects. Built for TikTok and Reels creators.',
};

export default function LandingPage() {
  return (
    <main style={{ backgroundColor: '#131313' }}>
      <Hero />
      <StyleShowcase />
      <HowItWorks />
      <Footer />
    </main>
  );
}
