import apiClient from '../api/client';

/**
 * Direct browser upload to Cloudinary CDN using signed backend authorization signature
 */
export const uploadToCloudinary = async (file, folder = 'bookbuddy') => {
  try {
    // 1. Fetch Cloudinary signature from backend
    const { data: sigRes } = await apiClient.post('/uploads/cloudinary-signature', {
      folder,
    });

    const sigData = sigRes.data;

    if (!sigData.configured) {
      console.warn('Cloudinary not configured on server:', sigData.message);
      return null;
    }

    // 2. Upload file directly to Cloudinary CDN
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigData.apiKey);
    formData.append('timestamp', sigData.timestamp);
    formData.append('signature', sigData.signature);
    formData.append('folder', sigData.folder);

    const res = await fetch(sigData.uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const cloudinaryResult = await res.json();
    return {
      success: true,
      secureUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      format: cloudinaryResult.format,
      bytes: cloudinaryResult.bytes,
    };
  } catch (err) {
    console.error('Direct Cloudinary Upload Failed:', err);
    return null;
  }
};
