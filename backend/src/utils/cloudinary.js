const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const logger = require('./logger');

const isCloudinaryConfigured = () => {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Generates signed parameter payload for direct-from-browser uploads to Cloudinary CDN
 */
const generateCloudinarySignature = ({ folder = 'bookbuddy', tags = [] }) => {
  if (!isCloudinaryConfigured()) {
    return {
      configured: false,
      message:
        'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not set.',
    };
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const paramsToSign = {
    timestamp,
    folder,
    ...(tags.length > 0 && { tags: tags.join(',') }),
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET);

  return {
    configured: true,
    signature,
    timestamp,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
};

/**
 * Delete image asset from Cloudinary CDN by public_id
 */
const deleteCloudinaryImage = async (publicId) => {
  if (!isCloudinaryConfigured() || !publicId) return false;
  try {
    const res = await cloudinary.uploader.destroy(publicId);
    return res.result === 'ok';
  } catch (err) {
    logger.warn(`Failed to delete Cloudinary asset ${publicId}:`, err.message);
    return false;
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  generateCloudinarySignature,
  deleteCloudinaryImage,
};
