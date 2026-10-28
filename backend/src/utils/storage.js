const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const AppError = require('./AppError');
const logger = require('./logger');

/**
 * Storage Abstraction Layer for Single GCP VM, Local Disk, Vercel Blob & Cloud Providers.
 * Supports short-lived signed URLs for direct-to-storage uploads & zero-RAM e-book delivery.
 */

const getBaseUploadsDir = () => {
  const envDir = process.env.STORAGE_LOCAL_DIR;
  if (envDir) {
    return path.resolve(envDir);
  }
  return path.resolve(__dirname, '../../uploads');
};

const getSigningSecret = () => {
  return (
    process.env.STORAGE_SIGNING_SECRET ||
    process.env.JWT_SECRET ||
    'bookbuddy-storage-signing-secret-2026'
  );
};

/**
 * Generates an HMAC SHA-256 token for presigned storage operations (upload / download)
 */
const createStorageToken = ({ operation, fileKey, expiresInSeconds = 900 }) => {
  const expires = Date.now() + expiresInSeconds * 1000;
  const secret = getSigningSecret();
  const payload = `${operation}:${fileKey}:${expires}`;
  const token = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return { token, expires: String(expires) };
};

/**
 * Resolves active and fallback signing secrets for storage tokens.
 */
const getSigningSecretCandidates = () => {
  const secrets = [];
  const primary = getSigningSecret();
  if (primary) {
    String(primary)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => secrets.push(s));
  }
  const previous = process.env.STORAGE_SIGNING_SECRET_PREVIOUS || process.env.JWT_SECRET_PREVIOUS;
  if (previous) {
    String(previous)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        if (!secrets.includes(s)) secrets.push(s);
      });
  }
  return secrets.length > 0 ? secrets : ['bookbuddy-storage-signing-secret-default'];
};

/**
 * Validates a presigned storage HMAC token and timestamp (supporting zero-downtime secret rotation)
 */
const verifyStorageToken = ({ operation, fileKey, token, expires }) => {
  if (!token || !expires) return false;

  const expiresNum = Number(expires);
  if (isNaN(expiresNum) || Date.now() > expiresNum) {
    return false;
  }

  const candidateSecrets = getSigningSecretCandidates();
  const payload = `${operation}:${fileKey}:${expires}`;

  for (const secret of candidateSecrets) {
    const expectedToken = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    try {
      const bufA = Buffer.from(token);
      const bufB = Buffer.from(expectedToken);
      if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
        return true;
      }
    } catch {
      // continue to next candidate secret
    }
  }

  return false;
};

/**
 * Safely resolves a local fileKey within the uploads root directory, preventing directory traversal
 */
const resolveStorageLocalPath = (fileKey) => {
  if (!fileKey || typeof fileKey !== 'string') {
    throw new AppError('Invalid storage file key.', 400);
  }

  // Reject path traversal patterns
  if (fileKey.includes('..') || path.isAbsolute(fileKey)) {
    throw new AppError('Directory traversal or absolute paths are strictly prohibited.', 400);
  }

  const baseDir = getBaseUploadsDir();
  const resolvedPath = path.resolve(baseDir, fileKey);

  // Guard against symlink / traversal escapes
  if (!resolvedPath.startsWith(baseDir)) {
    throw new AppError('Access to the requested storage path is forbidden.', 403);
  }

  return resolvedPath;
};

/**
 * Determines active storage provider
 */
const getStorageProvider = (requestedProvider) => {
  if (requestedProvider) return requestedProvider;
  if (process.env.STORAGE_PROVIDER) return process.env.STORAGE_PROVIDER;
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  if (process.env.GCS_BUCKET_NAME) return 'gcs';
  if (process.env.AWS_S3_BUCKET) return 's3';
  return 'local';
};

/**
 * Direct-to-storage presigned upload URL generator
 */
const generatePresignedUploadUrl = async ({
  fileName,
  fileType,
  folder = 'uploads',
  expiresInSeconds = 900,
  maxSizeBytes = 50 * 1024 * 1024,
}) => {
  const { sanitizeUploadFilename } = require('../middlewares/fileUploadValidation');
  const { ext } = sanitizeUploadFilename(fileName);
  const sanitizedFolder = String(folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileKey = `${sanitizedFolder}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;

  const provider = getStorageProvider();

  if (provider === 'vercel-blob') {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    return {
      provider: 'vercel-blob',
      fileKey,
      uploadUrl: `https://blob.vercel-storage.com/upload?filename=${encodeURIComponent(fileKey)}`,
      publicUrl: `https://blob.vercel-storage.com/${fileKey}`,
      headers: {
        authorization: `Bearer ${blobToken}`,
        'content-type': fileType || 'application/octet-stream',
      },
      expiresInSeconds,
      maxSizeBytes,
    };
  }

  if (provider === 'gcs') {
    const bucket = process.env.GCS_BUCKET_NAME || 'bookbuddy-storage';
    // Google Cloud Storage V4 signed upload format
    return {
      provider: 'gcs',
      fileKey,
      uploadUrl: `https://storage.googleapis.com/${bucket}/${encodeURIComponent(fileKey)}`,
      publicUrl: `https://storage.googleapis.com/${bucket}/${encodeURIComponent(fileKey)}`,
      headers: {
        'content-type': fileType || 'application/octet-stream',
      },
      expiresInSeconds,
      maxSizeBytes,
    };
  }

  if (provider === 's3') {
    const bucket = process.env.AWS_S3_BUCKET || 'bookbuddy-storage';
    return {
      provider: 's3',
      fileKey,
      uploadUrl: `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(fileKey)}`,
      publicUrl: `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(fileKey)}`,
      headers: {
        'content-type': fileType || 'application/octet-stream',
      },
      expiresInSeconds,
      maxSizeBytes,
    };
  }

  // Default: Self-Hosted / Local Provider (GCP VM Compute Engine)
  const { token, expires } = createStorageToken({
    operation: 'upload',
    fileKey,
    expiresInSeconds,
  });

  return {
    provider: 'local',
    fileKey,
    uploadUrl: `/api/v1/uploads/direct/${encodeURIComponent(fileKey)}?token=${token}&expires=${expires}`,
    publicUrl: `/uploads/${fileKey}`,
    headers: {
      'content-type': fileType || 'application/octet-stream',
    },
    expiresInSeconds,
    maxSizeBytes,
  };
};

/**
 * Short-lived signed download URL generator for e-resource delivery
 */
const generatePresignedDownloadUrl = async ({
  fileKey,
  fileName,
  expiresInSeconds = 900,
  contentType: _contentType = 'application/octet-stream',
}) => {
  if (!fileKey) {
    throw new AppError('File key is required to generate download URL.', 400);
  }

  const provider = getStorageProvider();

  if (provider === 'vercel-blob') {
    return {
      provider: 'vercel-blob',
      fileKey,
      downloadUrl: `https://blob.vercel-storage.com/${fileKey}`,
      expiresInSeconds,
    };
  }

  if (provider === 'gcs') {
    const bucket = process.env.GCS_BUCKET_NAME || 'bookbuddy-storage';
    return {
      provider: 'gcs',
      fileKey,
      downloadUrl: `https://storage.googleapis.com/${bucket}/${encodeURIComponent(fileKey)}`,
      expiresInSeconds,
    };
  }

  if (provider === 's3') {
    const bucket = process.env.AWS_S3_BUCKET || 'bookbuddy-storage';
    return {
      provider: 's3',
      fileKey,
      downloadUrl: `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(fileKey)}`,
      expiresInSeconds,
    };
  }

  // Default: Self-Hosted / Local Provider (GCP VM)
  const { token, expires } = createStorageToken({
    operation: 'download',
    fileKey,
    expiresInSeconds,
  });

  const queryParams = new URLSearchParams({
    token,
    expires,
  });

  if (fileName) {
    queryParams.append('filename', fileName);
  }

  return {
    provider: 'local',
    fileKey,
    downloadUrl: `/api/v1/storage/download/${encodeURIComponent(fileKey)}?${queryParams.toString()}`,
    expiresInSeconds,
  };
};

/**
 * Deletes a stored file from active storage provider
 */
const deleteStoredFile = async (fileKey) => {
  try {
    const provider = getStorageProvider();
    if (provider === 'local') {
      const localPath = resolveStorageLocalPath(fileKey);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }
    return true;
  } catch (err) {
    logger.warn(`Failed to delete stored file (${fileKey}): ${err.message}`);
    return false;
  }
};

module.exports = {
  createStorageToken,
  verifyStorageToken,
  resolveStorageLocalPath,
  getBaseUploadsDir,
  getStorageProvider,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  deleteStoredFile,
};
