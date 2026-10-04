import { PDFDocument } from 'pdf-lib';

/**
 * Format bytes to readable string (e.g. 1.2 MB, 450 KB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Dynamically load PDF.js from CDN if not already loaded in window
 */
export async function loadPdfJs() {
  if (typeof window === 'undefined') return null;
  if (window.pdfjsLib) return window.pdfjsLib;

  return new Promise((resolve, reject) => {
    // Check if script already exists
    const existing = document.querySelector('script[src*="pdf.js"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('pdfjsLib initialization failed'));
        }
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('pdfjsLib not found on window'));
      }
    };
    script.onerror = () => reject(new Error('Gagal memuat engine PDF.js dari CDN'));
    document.head.appendChild(script);
  });
}

/**
 * Compress an Image File (JPEG, PNG, WEBP, etc.)
 * @param {File|Blob} file 
 * @param {Object} options { quality, maxWidth, maxHeight, outputType }
 * @returns {Promise<{ file: File, originalSize: number, compressedSize: number, percentSaved: number, previewUrl: string, width: number, height: number }>}
 */
export async function compressImage(file, options = {}) {
  const {
    quality = 0.72,
    maxWidth = 1600,
    maxHeight = 1600,
    outputType = 'image/jpeg'
  } = options;

  const originalSize = file.size;

  // Don't compress GIF or non-images
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      percentSaved: 0,
      previewUrl: typeof window !== 'undefined' ? URL.createObjectURL(file) : '',
      width: 0,
      height: 0,
      type: 'image'
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while clamping to maxWidth & maxHeight
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Clean white background for transparency conversion to JPEG
        if (outputType === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= originalSize) {
              // If compression didn't reduce size, keep original
              const previewUrl = URL.createObjectURL(file);
              resolve({
                file,
                originalSize,
                compressedSize: originalSize,
                percentSaved: 0,
                previewUrl,
                width: img.width,
                height: img.height,
                type: 'image'
              });
              return;
            }

            const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], newFileName, {
              type: outputType,
              lastModified: Date.now()
            });

            const percentSaved = Math.round(((originalSize - blob.size) / originalSize) * 100);
            const previewUrl = URL.createObjectURL(blob);

            resolve({
              file: compressedFile,
              originalSize,
              compressedSize: blob.size,
              percentSaved,
              previewUrl,
              width,
              height,
              type: 'image'
            });
          },
          outputType,
          quality
        );
      };

      img.onerror = () => {
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          percentSaved: 0,
          previewUrl: URL.createObjectURL(file),
          width: 0,
          height: 0,
          type: 'image'
        });
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        percentSaved: 0,
        previewUrl: '',
        width: 0,
        height: 0,
        type: 'image'
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compress a PDF File
 * @param {File|Blob} file 
 * @param {Object} options { mode: 'balanced'|'extreme'|'high'|'lossless', quality, scale }
 * @param {Function} onProgress callback(percent, pageNum, totalPages)
 * @returns {Promise<{ file: File, originalSize: number, compressedSize: number, percentSaved: number, numPages: number, previewUrl: string, type: 'pdf' }>}
 */
export async function compressPdf(file, options = {}, onProgress = () => {}) {
  const {
    mode = 'balanced',
    quality: customQuality,
    scale: customScale
  } = options;

  const originalSize = file.size;

  // Preset parameters
  let quality = 0.70;
  let scale = 1.4; // ~140 DPI, sharp for text scans

  if (mode === 'extreme') {
    quality = 0.50;
    scale = 1.1; // Extra lightweight for strict < 500KB limits
  } else if (mode === 'high') {
    quality = 0.85;
    scale = 1.8;
  }

  if (customQuality !== undefined) quality = customQuality;
  if (customScale !== undefined) scale = customScale;

  const arrayBuffer = await file.arrayBuffer();

  // Mode: Lossless (structural stream compression only)
  if (mode === 'lossless') {
    try {
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const numPages = pdfDoc.getPageCount();
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });

      const compressedSize = compressedBytes.byteLength;
      if (compressedSize < originalSize) {
        const compressedBlob = new Blob([compressedBytes], { type: 'application/pdf' });
        const compressedFile = new File([compressedBlob], file.name, {
          type: 'application/pdf',
          lastModified: Date.now()
        });
        const percentSaved = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        return {
          file: compressedFile,
          originalSize,
          compressedSize,
          percentSaved,
          numPages,
          previewUrl: URL.createObjectURL(compressedBlob),
          type: 'pdf'
        };
      }
    } catch (losslessErr) {
      console.warn('Lossless PDF optimization skipped:', losslessErr);
    }

    return {
      file,
      originalSize,
      compressedSize: originalSize,
      percentSaved: 0,
      numPages: 1,
      previewUrl: typeof window !== 'undefined' ? URL.createObjectURL(file) : '',
      type: 'pdf'
    };
  }

  // Rasterized High-Efficiency Scan Compression (pdf.js + pdf-lib)
  try {
    const pdfjsLib = await loadPdfJs();
    if (!pdfjsLib) {
      throw new Error('PDF.js unavailable');
    }

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const newPdfDoc = await PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      onProgress({
        current: pageNum,
        total: numPages,
        percent: Math.round(((pageNum - 0.5) / numPages) * 100)
      });

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');

      // White background for scans
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Convert page canvas to JPEG blob
      const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64Data = imgDataUrl.split(',')[1];
      const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const jpgImage = await newPdfDoc.embedJpg(imgBytes);

      // Page dimensions in PDF points (72 DPI reference)
      const originalViewport = page.getViewport({ scale: 1.0 });
      const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);
      newPage.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height
      });

      onProgress({
        current: pageNum,
        total: numPages,
        percent: Math.round((pageNum / numPages) * 100)
      });
    }

    const compressedBytes = await newPdfDoc.save({ useObjectStreams: true });
    const compressedSize = compressedBytes.byteLength;

    // Use compressed if it's smaller, otherwise return original
    if (compressedSize < originalSize) {
      const compressedBlob = new Blob([compressedBytes], { type: 'application/pdf' });
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'application/pdf',
        lastModified: Date.now()
      });
      const percentSaved = Math.round(((originalSize - compressedSize) / originalSize) * 100);
      return {
        file: compressedFile,
        originalSize,
        compressedSize,
        percentSaved,
        numPages,
        previewUrl: URL.createObjectURL(compressedBlob),
        type: 'pdf'
      };
    } else {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        percentSaved: 0,
        numPages,
        previewUrl: URL.createObjectURL(file),
        type: 'pdf'
      };
    }

  } catch (err) {
    console.error('PDF Raster compression error, falling back to structural:', err);
    // Fallback: try structural pdf-lib optimization
    try {
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const numPages = pdfDoc.getPageCount();
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
      const compressedSize = compressedBytes.byteLength;

      if (compressedSize < originalSize) {
        const compressedBlob = new Blob([compressedBytes], { type: 'application/pdf' });
        const compressedFile = new File([compressedBlob], file.name, {
          type: 'application/pdf',
          lastModified: Date.now()
        });
        const percentSaved = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        return {
          file: compressedFile,
          originalSize,
          compressedSize,
          percentSaved,
          numPages,
          previewUrl: URL.createObjectURL(compressedBlob),
          type: 'pdf'
        };
      }
    } catch (fallbackErr) {
      console.error('Fallback structural optimization also failed:', fallbackErr);
    }

    return {
      file,
      originalSize,
      compressedSize: originalSize,
      percentSaved: 0,
      numPages: 1,
      previewUrl: typeof window !== 'undefined' ? URL.createObjectURL(file) : '',
      type: 'pdf'
    };
  }
}

/**
 * Universal compress function for any File (Image or PDF)
 * @param {File|Blob} file 
 * @param {Object} options 
 * @param {Function} onProgress 
 */
export async function compressFile(file, options = {}, onProgress = () => {}) {
  if (!file) return null;

  const isPdf = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));
  const isImage = file.type.startsWith('image/');

  if (isPdf) {
    return await compressPdf(file, options, onProgress);
  } else if (isImage) {
    return await compressImage(file, options);
  }

  // Other file types untouched
  return {
    file,
    originalSize: file.size,
    compressedSize: file.size,
    percentSaved: 0,
    previewUrl: '',
    type: 'other'
  };
}

/**
 * Compress multiple files sequentially with progress
 */
export async function compressMultipleFiles(filesList, options = {}, onFileProgress = () => {}) {
  const results = [];
  for (let i = 0; i < filesList.length; i++) {
    const file = filesList[i];
    const res = await compressFile(file, options, (prog) => {
      onFileProgress({
        fileIndex: i,
        totalFiles: filesList.length,
        fileName: file.name,
        ...prog
      });
    });
    results.push(res);
  }
  return results;
}
