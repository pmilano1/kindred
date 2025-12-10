import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { pool } from './pool';

// Storage configuration from database settings
let storageConfig: {
  provider: 'local' | 's3';
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  presignedUrlExpiry: number;
} | null = null;

async function getStorageConfig() {
  if (storageConfig) return storageConfig;

  const settings = await pool.query(
    `SELECT key, value FROM settings WHERE key LIKE 'storage%'`,
  );

  const config: Record<string, string> = {};
  for (const row of settings.rows) {
    config[row.key] = row.value;
  }

  storageConfig = {
    provider: (config.storage_provider as 'local' | 's3') || 'local',
    s3Bucket: config.storage_s3_bucket || undefined,
    s3Region: config.storage_s3_region || 'us-east-1',
    s3AccessKey: config.storage_s3_access_key || undefined,
    s3SecretKey: config.storage_s3_secret_key || undefined,
    presignedUrlExpiry: Number.parseInt(
      config.storage_presigned_url_expiry || '3600',
      10,
    ),
  };

  return storageConfig;
}

// Reset config cache (call when settings change)
export function resetStorageConfig() {
  storageConfig = null;
}

// Get S3 client
function getS3Client(region: string, accessKey?: string, secretKey?: string) {
  const config: {
    region: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  } = { region };

  // Use explicit credentials if provided, otherwise use IAM role
  if (accessKey && secretKey) {
    config.credentials = {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    };
  }

  return new S3Client(config);
}

// Generate nanoid-style ID (12 chars)
export function generateFileId(): string {
  return Math.random().toString(36).substring(2, 14).padEnd(12, '0');
}

// Upload file to storage
export async function uploadFile(
  buffer: Buffer,
  storagePath: string,
  mimeType: string,
): Promise<void> {
  const config = await getStorageConfig();

  if (config.provider === 's3') {
    if (!config.s3Bucket) {
      throw new Error('S3 bucket not configured');
    }

    const s3 = getS3Client(
      config.s3Region || 'us-east-1',
      config.s3AccessKey,
      config.s3SecretKey,
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: storagePath,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
  } else {
    // Local storage
    const filepath = join(process.cwd(), 'public', storagePath);
    const dir = filepath.substring(0, filepath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(filepath, buffer);
  }
}

// Get presigned URL for file (S3) or local path
export async function getFileUrl(storagePath: string): Promise<string> {
  const config = await getStorageConfig();

  if (config.provider === 's3') {
    if (!config.s3Bucket) {
      throw new Error('S3 bucket not configured');
    }

    const s3 = getS3Client(
      config.s3Region || 'us-east-1',
      config.s3AccessKey,
      config.s3SecretKey,
    );

    const command = new GetObjectCommand({
      Bucket: config.s3Bucket,
      Key: storagePath,
    });

    return await getSignedUrl(s3, command, {
      expiresIn: config.presignedUrlExpiry,
    });
  }

  // Local storage - return public path
  return `/${storagePath}`;
}

// Delete file from storage
export async function deleteFile(storagePath: string): Promise<void> {
  const config = await getStorageConfig();

  if (config.provider === 's3') {
    if (!config.s3Bucket) {
      throw new Error('S3 bucket not configured');
    }

    const s3 = getS3Client(
      config.s3Region || 'us-east-1',
      config.s3AccessKey,
      config.s3SecretKey,
    );

    await s3.send(
      new DeleteObjectCommand({
        Bucket: config.s3Bucket,
        Key: storagePath,
      }),
    );
  } else {
    // Local storage
    const filepath = join(process.cwd(), 'public', storagePath);
    await unlink(filepath);
  }
}
