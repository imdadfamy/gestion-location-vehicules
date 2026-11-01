const MAX_SIDE = 1800;
const QUALITY = 0.82;

/**
 * Réduit une photo (téléphone) avant envoi : redimensionnée à 1800 px au plus grand côté,
 * orientation corrigée, enregistrée en JPEG. Les PDF et les formats que le navigateur ne sait
 * pas lire (ex. HEIC) sont renvoyés tels quels ; la version réduite n'est gardée que si elle
 * est plus légère que l'original.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob || (blob.size >= file.size && file.type === 'image/jpeg' && scale === 1)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
