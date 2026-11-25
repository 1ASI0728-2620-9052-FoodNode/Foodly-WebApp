/** Image rules enforced by Foodly-Business-Service (ImageStorageAdapter / ImageApplicationService). */
export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_GALLERY_IMAGES = 20;
export const MAX_DISH_IMAGES = 10;

/** @returns {string} Spanish error, or '' when the file can be uploaded */
export function validateImageFile(file) {
  if (!file) return 'Elige una imagen.';
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Usa una imagen JPG, PNG o WebP.';
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen no puede pesar más de 5 MB.';
  if (file.size === 0) return 'El archivo está vacío.';
  return '';
}

export function imageLimit({ dish = false } = {}) {
  return dish ? MAX_DISH_IMAGES : MAX_GALLERY_IMAGES;
}
