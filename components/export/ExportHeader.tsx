/**
 * Static chat header for Puppeteer frame capture.
 *
 * Style-specific headers matching real app UIs:
 * - iMessage: back chevron + "Messages", centered name, FaceTime icon
 * - WhatsApp: back arrow, avatar, name/online, video + call icons
 * - Instagram: back arrow, avatar, name/active, phone + video icons
 *
 * Uses plain <img> (NOT next/image) for Puppeteer compatibility.
 * Uses ONLY inline styles for deterministic rendering.
 */

import type { ChatContact, ChatStyle, StyleTokens } from '@/lib/types';

interface ExportHeaderProps {
  contact: ChatContact;
  tokens: StyleTokens;
  style: ChatStyle;
}

export function ExportHeader({ contact, tokens, style }: ExportHeaderProps) {
  if (style === 'whatsapp') return <WhatsAppExportHeader contact={contact} tokens={tokens} />;
  if (style === 'instagram') return <InstagramExportHeader contact={contact} tokens={tokens} />;
  return <IMessageExportHeader contact={contact} tokens={tokens} />;
}

function IMessageExportHeader({ contact, tokens }: { contact: ChatContact; tokens: StyleTokens }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 10,
        fontFamily: tokens.fontFamily,
      }}
    >
      {/* Left: back chevron + "Messages" */}
      <div style={{ position: 'absolute', left: 12, display: 'flex', alignItems: 'center', gap: 2 }}>
        <span style={{ color: '#007AFF', fontSize: 20, fontWeight: 300 }}>&#8249;</span>
        <span style={{ color: '#007AFF', fontSize: 15 }}>Messages</span>
      </div>

      {/* Center: name */}
      <span style={{ fontWeight: 600, fontSize: 15, color: '#000000' }}>{contact.name}</span>

      {/* Right: FaceTime icon */}
      <div style={{ position: 'absolute', right: 12, display: 'flex', alignItems: 'center' }}>
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
          <rect x="0.5" y="2" width="13" height="12" rx="2" stroke="#007AFF" strokeWidth="1.5" />
          <path d="M15 6L19 3.5V12.5L15 10V6Z" stroke="#007AFF" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function WhatsAppExportHeader({ contact, tokens }: { contact: ChatContact; tokens: StyleTokens }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 8,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: tokens.headerBg,
        color: tokens.headerText,
        fontFamily: tokens.fontFamily,
      }}
    >
      {/* Back arrow */}
      <span style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 300 }}>&#8249;</span>

      {/* Avatar */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: '#DFE5E7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {contact.profileImageUrl ? (
          <img src={contact.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z" />
          </svg>
        )}
      </div>

      {/* Name + online */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 15, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.name}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>online</div>
      </div>

      {/* Video + call icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginRight: 4 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M17 2H7C5.9 2 5 2.9 5 4V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V4C19 2.9 18.1 2 17 2ZM12 17.5C11.17 17.5 10.5 16.83 10.5 16C10.5 15.17 11.17 14.5 12 14.5C12.83 14.5 13.5 15.17 13.5 16C13.5 16.83 12.83 17.5 12 17.5ZM15.5 13H8.5V4.5H15.5V13Z" />
        </svg>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M6.62 10.79a15.91 15.91 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.72 11.72 0 003.68.59 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.72 11.72 0 00.59 3.68 1 1 0 01-.25 1.02l-2.22 2.09z" />
        </svg>
      </div>
    </div>
  );
}

function InstagramExportHeader({ contact, tokens }: { contact: ChatContact; tokens: StyleTokens }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 12,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: tokens.headerBg,
        color: tokens.headerText,
        fontFamily: tokens.fontFamily,
      }}
    >
      {/* Back arrow */}
      <span style={{ color: '#262626', fontSize: 20, fontWeight: 300 }}>&#8249;</span>

      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          border: '1px solid #E0E0E0',
        }}
      >
        {contact.profileImageUrl ? (
          <img src={contact.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #A855F7, #EC4899)',
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {contact.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name + Active */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#262626' }}>{contact.name}</div>
        <div style={{ fontSize: 11, color: '#8E8E8E' }}>Active now</div>
      </div>

      {/* Phone + video icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginRight: 4 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        </svg>
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
          <rect x="0.5" y="2" width="13" height="12" rx="2" stroke="#262626" strokeWidth="1.5" />
          <path d="M15 6L19 3.5V12.5L15 10V6Z" stroke="#262626" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
