'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { Image, FileText, Upload, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { UPLOAD_MEDIA, DELETE_MEDIA } from '@/lib/graphql/queries';

interface MediaItem {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  media_type: string;
  caption: string | null;
  url?: string;
}

interface MediaGalleryProps {
  personId: string;
  media: MediaItem[];
  canEdit: boolean;
  onMediaChange?: () => void;
}

export default function MediaGallery({ personId, media, canEdit, onMediaChange }: MediaGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadMediaMutation] = useMutation(UPLOAD_MEDIA);
  const [deleteMediaMutation] = useMutation(DELETE_MEDIA);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload file to API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('personId', personId);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { file: fileInfo } = await response.json();

      // Create media record via GraphQL
      await uploadMediaMutation({
        variables: {
          personId,
          input: fileInfo,
        },
      });

      onMediaChange?.();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file: ' + (error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (mediaId: string) => {
    if (!confirm('Are you sure you want to delete this media?')) return;

    try {
      await deleteMediaMutation({ variables: { id: mediaId } });
      onMediaChange?.();
      setSelectedMedia(null);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete media');
    }
  };

  const getMediaIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-8 h-8" />;
    return <FileText className="w-8 h-8" />;
  };

  const getMediaUrl = (item: MediaItem) => item.url || `/api/media/${item.filename}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📷 Photos & Documents</h3>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              loading={uploading}
              size="sm"
              icon={<Upload className="w-4 h-4" />}
            >
              Upload
            </Button>
          </>
        )}
      </div>

      {media.length === 0 ? (
        <p className="text-gray-500 text-sm">No photos or documents yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative group cursor-pointer rounded-lg overflow-hidden border hover:border-blue-500 transition-colors"
              onClick={() => setSelectedMedia(item)}
            >
              {item.mime_type.startsWith('image/') ? (
                <img
                  src={getMediaUrl(item)}
                  alt={item.caption || item.original_filename}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                  {getMediaIcon(item.mime_type)}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                {item.caption || item.original_filename}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedMedia && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMedia(null)}>
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedMedia(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 hover:bg-transparent"
            >
              <X className="w-8 h-8" />
            </Button>
            {selectedMedia.mime_type.startsWith('image/') ? (
              <img src={getMediaUrl(selectedMedia)} alt={selectedMedia.caption || ''} className="max-h-[80vh] rounded-lg" />
            ) : (
              <iframe src={getMediaUrl(selectedMedia)} className="w-[80vw] h-[80vh] bg-white rounded-lg" />
            )}
            <div className="mt-2 text-white text-center">
              <p>{selectedMedia.caption || selectedMedia.original_filename}</p>
              {canEdit && (
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => handleDelete(selectedMedia.id)} icon={<Trash2 className="w-4 h-4" />}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

