const path = require('path');
const crypto = require('crypto');

/**
 * Storage Abstraction Layer for Vercel & Production Deployments.
 * Direct-to-storage presigned upload URL handler bypasses Vercel's 4.5MB serverless payload limit.
 */
const generatePresignedUploadUrl = async ({ fileName, fileType, folder = 'uploads' }) => {
  const sanitizedExt = path.extname(fileName) || '.bin';
  const fileKey = `${folder}/${Date.now()}_${crypto.randomBytes(8).toString('hex')}${sanitizedExt}`;

  // Evaluate Vercel Blob or S3/GCS credentials if provided
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    // Vercel Blob presigned URL allocation
    return {
      provider: 'vercel-blob',
      fileKey,
      uploadUrl: `https://blob.vercel-storage.com/upload?filename=${encodeURIComponent(fileKey)}`,
      publicUrl: `https://blob.vercel-storage.com/${fileKey}`,
      headers: {
        authorization: `Bearer ${blobToken}`,
        'content-type': fileType || 'application/octet-stream',
      },
      expiresInSeconds: 900,
    };
  }

  // Fallback storage allocation (direct endpoint mock/local server upload)
  return {
    provider: 'local-fallback',
    fileKey,
    uploadUrl: `/api/v1/uploads/direct/${encodeURIComponent(fileKey)}`,
    publicUrl: `/uploads/${fileKey}`,
    headers: {
      'content-type': fileType || 'application/octet-stream',
    },
    expiresInSeconds: 900,
  };
};

module.exports = {
  generatePresignedUploadUrl,
};
