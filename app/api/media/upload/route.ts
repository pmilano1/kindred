import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadFile, generateFileId } from '@/lib/storage';

// Configure max file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (
      !session ||
      !session.user.role ||
      !['admin', 'editor'].includes(session.user.role)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const personId = formData.get('personId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!personId) {
      return NextResponse.json(
        { error: 'No personId provided' },
        { status: 400 },
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF' },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 10MB' },
        { status: 400 },
      );
    }

    // Generate unique filename with nanoid
    const ext = file.name.split('.').pop() || 'bin';
    const fileId = generateFileId();
    const filename = `${fileId}.${ext}`;
    const storagePath = `media/${personId}/${filename}`;

    // Upload file to storage (S3 or local based on settings)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await uploadFile(buffer, storagePath, file.type);

    // Determine media type
    let mediaType = 'other';
    if (file.type.startsWith('image/')) mediaType = 'photo';
    else if (file.type === 'application/pdf') mediaType = 'document';

    // Return file info for GraphQL mutation
    return NextResponse.json({
      success: true,
      file: {
        filename,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        media_type: mediaType,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
