/**
 * Root layout for TextStory Web.
 *
 * Loads three font families:
 * - Plus Jakarta Sans: headings, marketing copy
 * - Inter: body text, iMessage chat style rendering
 * - Roboto: WhatsApp chat style rendering
 */

import type { Metadata } from 'next';
import { Inter, Roboto, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TextStory — Create Texting Story Videos',
  description:
    'Create fake text conversations in iMessage, WhatsApp, and Instagram styles and export them as MP4 videos with typing animations and sound effects.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${inter.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-[#131313] text-[#e5e2e1] font-[family-name:var(--font-inter)]">
        {children}
      </body>
    </html>
  );
}
