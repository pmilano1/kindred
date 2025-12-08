'use client';

import { useMutation } from '@apollo/client/react';
import { FileText, Image as ImageIcon, Trash2, Upload, X } from 'lucide-react';
import NextImage from 'next/image';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { DELETE_MEDIA, UPLOAD_MEDIA } from '@/lib/graphql/queries';

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

export default function MediaGallery({
  personId,
  media,
  canEdit,
  onMediaChange,
}: MediaGalleryProps) {
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
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
    return <FileText className="w-8 h-8" />;
  };

  const getMediaUrl = (item: MediaItem) =>
    item.url || `/api/media/${item.filename}`;

  return (
    <div className="card p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="section-title">
          📷 Photos & Documents ({media.length})
        </h3>
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
              variant="secondary"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative group cursor-pointer rounded-lg overflow-hidden border border-border hover:border-primary transition-colors bg-muted"
              onClick={() => setSelectedMedia(item)}
            >
              {item.mime_type.startsWith('image/') ? (
                <NextImage
                  src={getMediaUrl(item)}
                  alt={item.caption || item.original_filename}
                  width={200}
                  height={128}
                  className="w-full h-32 object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-muted text-muted-foreground">
                  {getMediaIcon(item.mime_type)}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
                {item.caption || item.original_filename}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="relative max-w-4xl max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedMedia(null)}
              className="absolute -top-12 right-0 text-foreground hover:bg-muted"
            >
              <X className="w-6 h-6" />
            </Button>
            {selectedMedia.mime_type.startsWith('image/') ? (
              <NextImage
                src={getMediaUrl(selectedMedia)}
                alt={selectedMedia.caption || selectedMedia.original_filename}
                width={800}
                height={600}
                className="max-h-[80vh] w-auto rounded-lg shadow-lg"
                unoptimized
              />
            ) : (
              <iframe
                src={getMediaUrl(selectedMedia)}
                title={selectedMedia.original_filename}
                className="w-[80vw] h-[80vh] bg-card rounded-lg shadow-lg"
              />
            )}
            <div className="mt-4 text-center">
              <p className="text-foreground font-medium">
                {selectedMedia.caption || selectedMedia.original_filename}
              </p>
              {canEdit && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                  onClick={() => handleDelete(selectedMedia.id)}
                  icon={<Trash2 className="w-4 h-4" />}
                >
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
