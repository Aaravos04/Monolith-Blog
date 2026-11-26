// Image helpers for the mock API. They shrink an uploaded image into a small JPEG data URL so
// it fits in localStorage. With a real backend you upload the File itself instead.

// Loads a File as an image, calls render(img) and resolves with whatever it returns.
const withImage = (file, render) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        resolve(render(img));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That file could not be read as an image.'));
    };

    img.src = objectUrl;
  });

// Scales down to maxWidth (keeping the shape). Used for cover images.
const fileToResizedDataUrl = (file, maxWidth = 1400, quality = 0.82) =>
  withImage(file, (img) => {
    const scale = Math.min(1, maxWidth / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // flatten transparent PNGs onto white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  });

// Crops the centre square and scales it to size x size. Used for profile pictures.
const fileToAvatarDataUrl = (file, size = 256, quality = 0.85) =>
  withImage(file, (img) => {
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  });

export { fileToResizedDataUrl, fileToAvatarDataUrl };
