import { type NextRequest, NextResponse } from 'next/server';
import { getFileUrl } from '@/lib/storage';

// Serve media files via presigned URLs (S3) or direct paths (local)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const storagePath = path.join('/');

    // Get URL (presigned for S3, local path for local storage)
    const url = await getFileUrl(storagePath);

    // For S3 presigned URLs, redirect to the URL
    // For local storage, the URL is a path like /media/personId/file.jpg
    if (url.startsWith('http')) {
      return NextResponse.redirect(url);
    }

    // For local storage, Next.js will serve from public/ automatically
    return NextResponse.redirect(new URL(url, request.url));
  } catch (error) {
    console.error('Media serve error:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
