export const IMAGE_PRESETS = [
  { id: 'original', label: 'Original ratio' },
  { id: 'product', label: 'Product square', ratio: 1, width: 1200 },
  { id: 'banner', label: 'Desktop banner', ratio: 3, width: 1920 },
  { id: 'mobile', label: 'Mobile banner', ratio: 3 / 4, width: 900 },
  { id: 'free', label: 'Freeform' },
];

export function rotatedSize(width, height, rotation) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

export function centeredCrop(width, height, ratio) {
  if (!ratio) return { unit: '%', x: 0, y: 0, width: 100, height: 100 };
  const w = Math.min(width, height * ratio);
  const h = w / ratio;
  return { unit: '%', x: (width - w) / width * 50, y: (height - h) / height * 50,
    width: w / width * 100, height: h / height * 100 };
}

export function cropPixels(crop, size) {
  const x = Math.max(0, Math.min(size.width - 1, Math.round(crop.x / 100 * size.width)));
  const y = Math.max(0, Math.min(size.height - 1, Math.round(crop.y / 100 * size.height)));
  return { x, y,
    width: Math.max(1, Math.min(size.width - x, Math.round(crop.width / 100 * size.width))),
    height: Math.max(1, Math.min(size.height - y, Math.round(crop.height / 100 * size.height))) };
}

export function outputSize(crop, requestedWidth) {
  const width = Math.max(1, Math.min(crop.width, 4096, Math.round(Number(requestedWidth) || crop.width)));
  const height = Math.max(1, Math.round(width * crop.height / crop.width));
  if (height > 4096) return { width: Math.max(1, Math.round(width * 4096 / height)), height: 4096 };
  return { width, height };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > 40_000_000) {
        reject(new Error('This image exceeds 40 megapixels. Resize it before editing.'));
      } else resolve(image);
    };
    image.onerror = () => reject(new Error('Could not load this image for editing. Check the file and try again.'));
    image.src = src;
  });
}

// Draw directly into the output canvas: no full-size intermediate rotated bitmap.
export function drawCrop(canvas, image, rotation, crop, output) {
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not open the image editor. Try another browser.');
  const size = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.scale(output.width / crop.width, output.height / crop.height);
  context.translate(-crop.x, -crop.y);
  context.translate(size.width / 2, size.height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
}

export function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not export the image. Please try again.')), 'image/webp', 0.92);
    } catch {
      reject(new Error('This image host does not allow editing. Download the image and upload it here first.'));
    }
  });
}

export async function exportEditedImage(image, rotation, crop, width, name) {
  const canvas = document.createElement('canvas');
  const size = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
  const pixels = cropPixels(crop, size);
  drawCrop(canvas, image, rotation, pixels, outputSize(pixels, width));
  const blob = await canvasBlob(canvas);
  if (blob.size > 5 * 1024 * 1024) throw new Error('The edited image exceeds 5 MB. Choose a smaller output size.');
  const extension = blob.type === 'image/webp' ? 'webp' : 'png';
  return new File([blob], `${(name || 'image').replace(/\.[^.]+$/, '').slice(0, 220)}-edited.${extension}`, { type: blob.type });
}

export function presetEdit(size, presetId = 'product', presets = IMAGE_PRESETS) {
  const preset = presets.find((item) => item.id === presetId) || IMAGE_PRESETS[1];
  const crop = centeredCrop(size.width, size.height, preset.ratio);
  const pixels = cropPixels(crop, size);
  return { preset: preset.id, presetDefinition: { ...preset }, rotation: 0, crop, width: outputSize(pixels, preset.width || pixels.width).width };
}

export function editPreview(image, settings) {
  const size = rotatedSize(image.naturalWidth, image.naturalHeight, settings.rotation);
  const pixels = cropPixels(settings.crop, size);
  const output = outputSize(pixels, settings.width);
  const scale = Math.min(1, 320 / Math.max(output.width, output.height));
  const canvas = document.createElement('canvas');
  drawCrop(canvas, image, settings.rotation, pixels, {
    width: Math.max(1, Math.round(output.width * scale)), height: Math.max(1, Math.round(output.height * scale)),
  });
  return { preview: canvas.toDataURL('image/webp', 0.8), output };
}
