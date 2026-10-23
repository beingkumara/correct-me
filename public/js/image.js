// Shrinks the chosen photo in the browser so it's quick to send: long edge ≤ 1600px, JPEG 0.85.

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

/** The browser couldn't decode the file (e.g. an iPhone HEIC in Chrome). Not a handwriting problem. */
export class UnsupportedFileError extends Error {
  constructor() {
    super('unsupported_file');
    this.name = 'UnsupportedFileError';
  }
}

/**
 * @param {File} file
 * @returns {Promise<string>} a data:image/jpeg;base64 URL
 */
export async function shrinkPhoto(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnsupportedFileError();
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
