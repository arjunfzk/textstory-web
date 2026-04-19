/**
 * Profile photo upload component.
 *
 * Uploads image to /api/upload, which handles EXIF correction + resize.
 * Shows current photo or placeholder.
 */

'use client';

import { useRef, useState } from 'react';
import { useChatStore } from '@/store/chat-store';

export function ProfileUpload() {
  const contact = useChatStore((s) => s.contact);
  const setContact = useChatStore((s) => s.setContact);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { url } = await res.json();
      setContact({ profileImageUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset file input so re-selecting the same file triggers onChange
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">Profile Photo</label>
      <div className="flex items-center gap-3">
        {/* Preview */}
        <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
          {contact.profileImageUrl ? (
            <img
              src={contact.profileImageUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-gray-500 text-lg font-bold">
              {contact.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="
            px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-xs
            hover:bg-gray-600 disabled:opacity-50 transition-colors cursor-pointer
          "
        >
          {uploading ? 'Uploading...' : 'Choose Photo'}
        </button>

        {contact.profileImageUrl && (
          <button
            type="button"
            onClick={() => setContact({ profileImageUrl: undefined })}
            className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
          >
            Remove
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
