/**
 * Inline contact editor — name input + profile photo upload.
 *
 * Uses react-hook-form + zod for the name field validation
 * as required by the project's CLAUDE.md conventions.
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useChatStore } from '@/store/chat-store';
import { ProfileUpload } from '@/components/editor/ProfileUpload';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(30, 'Max 30 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function ContactEditor() {
  const contact = useChatStore((s) => s.contact);
  const setContact = useChatStore((s) => s.setContact);
  const [isOpen, setIsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: contact.name },
  });

  function onSubmit(data: ContactFormData) {
    setContact({ name: data.name });
    setIsOpen(false);
  }

  function handleCancel() {
    reset({ name: contact.name });
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-[11px] transition-colors cursor-pointer rounded px-2 py-1"
        style={{ color: 'var(--text-secondary)', background: 'var(--surface-overlay)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        {contact.name}
      </button>
    );
  }

  return (
    <div className="rounded-lg p-3.5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label htmlFor="contact-name" className="text-[11px] mb-1 block" style={{ color: 'var(--text-tertiary)' }}>
            Contact Name
          </label>
          <input
            id="contact-name"
            {...register('name')}
            className="w-full rounded-md px-3 py-1.5 text-[13px] outline-none transition-colors"
            style={{
              background: 'var(--surface-input)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
          {errors.name && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--danger)' }}>{errors.name.message}</p>
          )}
        </div>

        <ProfileUpload />

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-md text-white text-[12px] font-medium transition-colors cursor-pointer"
            style={{ background: 'var(--action)' }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer"
            style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
