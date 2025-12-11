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
});
