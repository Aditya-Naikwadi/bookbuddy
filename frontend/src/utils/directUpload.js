import apiClient from "../api/client";
const MAX_EBOOK_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Uploads a file directly to storage via presigned URL
 * @param {File} file - The file to upload
 * @param {Object} options - Configuration options
 * @param {string} [options.folder='ebooks'] - Destination storage folder
 * @param {number} [options.maxSizeBytes=52428800] - Maximum allowed file size
 * @param {Function} [options.onProgress] - Optional progress callback (percent: number)
 * @returns {Promise<{ fileKey: string, publicUrl: string, sizeBytes: number }>}
 */
export const uploadLargeFileDirectly = async (file, options = {}) => {
  if (!file) {
    throw new Error("No file was provided for upload.");
  }

  const maxSizeBytes = options.maxSizeBytes || MAX_EBOOK_SIZE_BYTES;

  // 1. Client-Side Size Validation Guard
  if (file.size > maxSizeBytes) {
    const formattedFile = formatBytes(file.size);
    const formattedMax = formatBytes(maxSizeBytes);
    throw new Error(
      `File size (${formattedFile}) exceeds the maximum allowed limit of ${formattedMax}. Please select a smaller file.`,
    );
  }

  // 2. Request Presigned Upload URL from API
  let presignedData;
  try {
    const { data } = await apiClient.post("/uploads/presigned-url", {
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      folder: options.folder || "ebooks",
      maxSizeBytes,
    });
    presignedData = data?.data;
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err.message ||
      "Failed to obtain presigned upload URL from server.";
    throw new Error(`Upload authorization failed: ${msg}`, { cause: err });
  }

  if (!presignedData || !presignedData.uploadUrl) {
    throw new Error("Server did not return a valid presigned upload URL.");
  }

  const { uploadUrl, fileKey, publicUrl, headers = {} } = presignedData;

  // 3. Direct Binary Upload to Storage Destination
  try {
    const requestHeaders = { ...headers };
    if (!requestHeaders["Content-Type"] && !requestHeaders["content-type"]) {
      requestHeaders["Content-Type"] = file.type || "application/octet-stream";
    }

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: requestHeaders,
      body: file,
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error(
          `Storage rejected upload: file exceeds storage size limit (${formatBytes(maxSizeBytes)}).`,
        );
      }
      if (response.status === 403) {
        throw new Error(
          "Upload token expired or was rejected by storage server. Please try again.",
        );
      }
      let errorMsg = `Storage upload failed with HTTP status ${response.status}.`;
      try {
        const errorJson = await response.json();
        if (errorJson.message) errorMsg = errorJson.message;
      } catch {
        // use fallback error message
      }
      throw new Error(errorMsg);
    }

    return {
      fileKey,
      publicUrl,
      sizeBytes: file.size,
      fileName: file.name,
    };
  } catch (uploadErr) {
    if (uploadErr.name === "AbortError") {
      throw new Error("Upload was cancelled.", { cause: uploadErr });
    }
    throw uploadErr;
  }
};

export default {
  uploadLargeFileDirectly,
  MAX_EBOOK_SIZE_BYTES,
  formatBytes,
};
