/**
 * Storage Module Unit Tests
 * Tests storage operations (generateFileId, getFileUrl, config)
 */
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

const { mockQuery, mockS3Send, mockGetSignedUrl } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockS3Send: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock('@/lib/pool', () => ({
  pool: { query: mockQuery },
}));

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class MockS3Client {
      send = mockS3Send;
    },
    PutObjectCommand: class MockPutObjectCommand {
      constructor(public params: unknown) {}
    },
    GetObjectCommand: class MockGetObjectCommand {
      constructor(public params: unknown) {}
    },
    DeleteObjectCommand: class MockDeleteObjectCommand {
      constructor(public params: unknown) {}
    },
    HeadBucketCommand: class MockHeadBucketCommand {
      constructor(public params: unknown) {}
    },
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { generateFileId, getFileUrl, resetStorageConfig } from '@/lib/storage';

const mockedQuery = mockQuery as Mock;

describe('Storage Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStorageConfig();
  });

  describe('generateFileId', () => {
    it('generates a 12 character ID', () => {
      const id = generateFileId();
      expect(id).toHaveLength(12);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateFileId());
      }
      expect(ids.size).toBe(100);
    });

    it('generates alphanumeric IDs', () => {
      const id = generateFileId();
      expect(id).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('Local Storage', () => {
    beforeEach(() => {
      mockedQuery.mockResolvedValue({
        rows: [{ key: 'storage_provider', value: 'local' }],
      });
    });

    it('returns local path for getFileUrl', async () => {
      const url = await getFileUrl('media/test.jpg');
      expect(url).toBe('/media/test.jpg');
    });

    it('prefixes path correctly', async () => {
      const url = await getFileUrl('photos/portrait.png');
      expect(url).toBe('/photos/portrait.png');
    });
  });

  describe('S3 Storage', () => {
    beforeEach(() => {
      mockedQuery.mockResolvedValue({
        rows: [
          { key: 'storage_provider', value: 's3' },
          { key: 'storage_s3_bucket', value: 'test-bucket' },
          { key: 'storage_s3_region', value: 'us-east-1' },
          { key: 'storage_presigned_url_expiry', value: '3600' },
        ],
      });
    });

    it('returns presigned URL for getFileUrl', async () => {
      mockGetSignedUrl.mockResolvedValueOnce(
        'https://test-bucket.s3.amazonaws.com/media/test.jpg?signed=true',
      );

      const url = await getFileUrl('media/test.jpg');

      expect(url).toContain('s3.amazonaws.com');
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });

    it('uses correct expiry time', async () => {
      mockGetSignedUrl.mockResolvedValueOnce('https://example.com/signed');

      await getFileUrl('test.jpg');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 3600 }),
      );
    });
  });

  describe('resetStorageConfig', () => {
    it('clears cached config', async () => {
      // First call loads config
      mockedQuery.mockResolvedValueOnce({
        rows: [{ key: 'storage_provider', value: 'local' }],
      });
      await getFileUrl('test.jpg');

      // Reset
      resetStorageConfig();

      // Second call should query again
      mockedQuery.mockResolvedValueOnce({
        rows: [{ key: 'storage_provider', value: 'local' }],
      });
      await getFileUrl('test2.jpg');

      expect(mockedQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('uploadFile', () => {
    it('uploads to S3 when configured', async () => {
      mockedQuery.mockResolvedValue({
        rows: [
          { key: 'storage_provider', value: 's3' },
          { key: 'storage_s3_bucket', value: 'test-bucket' },
          { key: 'storage_s3_region', value: 'us-east-1' },
        ],
      });
      mockS3Send.mockResolvedValueOnce({});

      const { uploadFile } = await import('@/lib/storage');
      resetStorageConfig();

      await uploadFile(Buffer.from('test'), 'media/test.jpg', 'image/jpeg');

      expect(mockS3Send).toHaveBeenCalled();
    });

    it('throws when S3 bucket not configured', async () => {
      mockedQuery.mockResolvedValue({
        rows: [{ key: 'storage_provider', value: 's3' }],
      });

      const { uploadFile } = await import('@/lib/storage');
      resetStorageConfig();

      await expect(
        uploadFile(Buffer.from('test'), 'media/test.jpg', 'image/jpeg'),
      ).rejects.toThrow('S3 bucket not configured');
    });
  });

  describe('deleteFile', () => {
    it('deletes from S3 when configured', async () => {
      mockedQuery.mockResolvedValue({
        rows: [
          { key: 'storage_provider', value: 's3' },
          { key: 'storage_s3_bucket', value: 'test-bucket' },
          { key: 'storage_s3_region', value: 'us-east-1' },
        ],
      });
      mockS3Send.mockResolvedValueOnce({});

      const { deleteFile } = await import('@/lib/storage');
      resetStorageConfig();

      await deleteFile('media/test.jpg');

      expect(mockS3Send).toHaveBeenCalled();
    });

    it('throws when S3 bucket not configured', async () => {
      mockedQuery.mockResolvedValue({
        rows: [{ key: 'storage_provider', value: 's3' }],
      });

      const { deleteFile } = await import('@/lib/storage');
      resetStorageConfig();

      await expect(deleteFile('media/test.jpg')).rejects.toThrow(
        'S3 bucket not configured',
      );
    });
  });

  describe('testStorage', () => {
    it('tests S3 storage by uploading and deleting', async () => {
      mockedQuery.mockResolvedValue({
        rows: [
          { key: 'storage_provider', value: 's3' },
          { key: 'storage_s3_bucket', value: 'test-bucket' },
          { key: 'storage_s3_region', value: 'us-east-1' },
        ],
      });
      mockS3Send.mockResolvedValue({});

      const { testStorage } = await import('@/lib/storage');
      resetStorageConfig();

      const result = await testStorage();

      expect(result).toBe(true);
      expect(mockS3Send).toHaveBeenCalledTimes(2); // Put + Delete
    });

    it('throws when S3 bucket not configured', async () => {
      mockedQuery.mockResolvedValue({
        rows: [{ key: 'storage_provider', value: 's3' }],
      });

      const { testStorage } = await import('@/lib/storage');
      resetStorageConfig();

      await expect(testStorage()).rejects.toThrow('S3 bucket not configured');
    });

    it('throws when S3 operation fails', async () => {
      mockedQuery.mockResolvedValue({
        rows: [
          { key: 'storage_provider', value: 's3' },
          { key: 'storage_s3_bucket', value: 'test-bucket' },
        ],
      });
      mockS3Send.mockRejectedValueOnce(new Error('S3 error'));

      const { testStorage } = await import('@/lib/storage');
      resetStorageConfig();

      await expect(testStorage()).rejects.toThrow('S3 error');
    });
  });

  describe('getFileUrl error cases', () => {
    it('throws when S3 bucket not configured', async () => {
      mockedQuery.mockResolvedValue({
        rows: [{ key: 'storage_provider', value: 's3' }],
      });

      resetStorageConfig();

      await expect(getFileUrl('media/test.jpg')).rejects.toThrow(
        'S3 bucket not configured',
      );
    });
  });

  describe('S3 with explicit credentials', () => {
    it('uses provided access key and secret', async () => {
      mockedQuery.mockResolvedValue({
        rows: [
          { key: 'storage_provider', value: 's3' },
          { key: 'storage_s3_bucket', value: 'test-bucket' },
          { key: 'storage_s3_region', value: 'us-west-2' },
          { key: 'storage_s3_access_key', value: 'AKIATEST' },
          { key: 'storage_s3_secret_key', value: 'secret123' },
        ],
      });
      mockGetSignedUrl.mockResolvedValueOnce('https://signed-url.com');

      resetStorageConfig();
      await getFileUrl('test.jpg');

      expect(mockGetSignedUrl).toHaveBeenCalled();
    });
  });
});
