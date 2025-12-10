# S3 Storage Implementation

**Issue**: #267  
**Status**: Implementation Complete - Testing Required

## Overview

Implemented private S3 storage with presigned URLs for media files and coat of arms. Supports both S3 and local storage via admin configuration.

## Security Features

✅ **Zero Public Access**
- Block all public ACLs and policies
- No bucket policy allowing public reads
- All files served via presigned URLs (1-hour expiry)

✅ **Server-Side Encryption**
- AES-256 encryption at rest
- Automatic encryption for all uploads

✅ **IAM Role-Based Access**
- App Runner uses IAM role (no hardcoded credentials)
- Optional access keys for local development

## Storage Structure

```
s3://genealogy-media-{account-id}/
├── media/
│   └── {person_id}/
│       ├── {nanoid}.jpg
│       ├── {nanoid}.pdf
│       └── {nanoid}.png
├── crests/
│   └── {surname}/
│       └── {nanoid}.png
└── temp/
    └── {nanoid}/  (auto-deleted after 1 day)
```

## Database Schema

### Media Table (existing)
- `id`: 12-char nanoid (same as filename)
- `storage_path`: `media/{person_id}/{nanoid}.ext`
- `original_filename`: User's original filename

### Surname Crests Table (updated)
- `storage_path`: `crests/{surname}/{nanoid}.ext` (NEW)
- `coat_of_arms`: Base64 data (nullable after migration)

## Implementation Files

### Infrastructure
- `terraform/s3.tf` - S3 bucket, IAM policies, lifecycle rules
- `terraform/migrations/005_storage_settings.sql` - Storage settings

### Core Library
- `lib/storage.ts` - Upload, presigned URLs, delete functions
- `lib/graphql/resolvers.ts` - Updated Media and SurnameCrest resolvers

### API Routes
- `app/api/media/upload/route.ts` - Media file upload
- `app/api/media/[...path]/route.ts` - Serve presigned URLs
- `app/api/coats-of-arms/upload/route.ts` - Coat of arms upload

### Admin UI
- `components/admin/StorageSettings.tsx` - Storage configuration UI

### Migration
- `scripts/migrate-crests-to-storage.ts` - Convert base64 to S3

## Configuration

### Admin Settings (Database)
```sql
storage_provider: 'local' | 's3'
storage_s3_bucket: 'genealogy-media-123456789012'
storage_s3_region: 'us-east-1'
storage_s3_access_key: NULL (uses IAM role)
storage_s3_secret_key: NULL (uses IAM role)
storage_presigned_url_expiry: '3600' (1 hour)
```

### Environment Variables (Optional)
```bash
AWS_ACCESS_KEY_ID=...      # Optional, uses IAM role if not set
AWS_SECRET_ACCESS_KEY=...  # Optional, uses IAM role if not set
AWS_REGION=us-east-1
S3_MEDIA_BUCKET=genealogy-media-123456789012
```

## Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Apply Terraform
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

### 3. Run Database Migration
```bash
psql -h localhost -p 5433 -U genealogy -d genealogy -f terraform/migrations/005_storage_settings.sql
```

### 4. Configure Storage (Admin Panel)
1. Go to `/admin/settings`
2. Set `storage_provider` to `s3`
3. Set `storage_s3_bucket` to bucket name from Terraform output
4. Leave access keys empty (uses IAM role)

### 5. Migrate Existing Coat of Arms
```bash
npx tsx scripts/migrate-crests-to-storage.ts
```

### 6. Verify
- Upload a new media file
- Upload a new coat of arms
- Check S3 bucket for files
- Verify images display correctly

## Testing Checklist

- [ ] Terraform applies successfully
- [ ] S3 bucket created with correct permissions
- [ ] Database migration runs without errors
- [ ] Admin settings UI loads and saves
- [ ] Media upload works (creates file in S3)
- [ ] Media display works (presigned URL)
- [ ] Coat of arms upload works
- [ ] Coat of arms display works
- [ ] Migration script converts base64 to S3
- [ ] Old base64 crests still display (fallback)
- [ ] Presigned URLs expire after 1 hour
- [ ] Direct S3 URLs are blocked (403 Forbidden)

## Rollback Plan

If issues occur:

1. **Revert storage provider**:
   ```sql
   UPDATE settings SET value = 'local' WHERE key = 'storage_provider';
   ```

2. **Coat of arms fallback**: Base64 data still in database, will display automatically

3. **Media files**: No existing production data to lose

## Future Enhancements

- [ ] Direct browser uploads (presigned POST URLs)
- [ ] Image optimization/thumbnails
- [ ] CDN integration (CloudFront)
- [ ] Backup/versioning policies
- [ ] Storage usage metrics

