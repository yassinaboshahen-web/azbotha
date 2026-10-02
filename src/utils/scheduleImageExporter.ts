import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface MediaStoreScannerPlugin {
  scanFile(options: { path: string }): Promise<{ uri: string; path: string }>;
}

const MediaStoreScanner = registerPlugin<MediaStoreScannerPlugin>('MediaStoreScanner');

export interface ExportResult {
  success: boolean;
  dataUrl?: string;
  fileUri?: string;
  filename: string;
  isNative: boolean;
  error?: string;
}

/**
 * Converts an HTML5 Canvas into a high-resolution PNG dataUrl and Blob.
 */
export async function canvasToBlobAndDataUrl(
  canvas: HTMLCanvasElement
): Promise<{ dataUrl: string; blob: Blob }> {
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('تعذر تحويل الرسم إلى ملف صورة'));
    }, 'image/png', 1.0);
  });

  return { dataUrl, blob };
}

/**
 * Saves or downloads the generated image depending on environment (Native Android or Web).
 */
export async function saveOrDownloadImage(
  dataUrl: string,
  filename: string,
  title: string = 'جدول المواعيد'
): Promise<ExportResult> {
  const isNative = Capacitor.isNativePlatform();
  const cleanFilename = filename.replace(/^azbotha-/, '').replace(/^azbotha_\d+_/, '');
  const uniqueFilename = `azbotha_${Date.now()}_${cleanFilename}`;

  if (isNative) {
    const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
    const candidatePaths = [
  {
    directory: Directory.Documents,
    path: `Pictures/Azbotha/${uniqueFilename}`,
  },
];

    let writtenUri: string | null = null;
    let lastError: any = null;

    for (const cand of candidatePaths) {
      try {
        const writeResult = await Filesystem.writeFile({
          path: cand.path,
          data: base64Data,
          directory: cand.directory,
          recursive: true,
        });

        // Trigger Android MediaStore Scanner so image appears in Gallery & Photos instantly
        try {
          let filePath = writeResult.uri;
          if (filePath.startsWith('file://')) {
            filePath = filePath.replace('file://', '');
          }
          await MediaStoreScanner.scanFile({ path: filePath });
        } catch (scanErr) {
          console.warn('MediaStore scan notice:', scanErr);
        }

        // Verify file existence actually succeeded
        try {
          await Filesystem.stat({
            path: cand.path,
            directory: cand.directory,
          });
          writtenUri = writeResult.uri;
          break;
        } catch (statErr) {
          console.warn('Stat check failed after write:', statErr);
        }
      } catch (err) {
        lastError = err;
        console.warn(`Failed writing image to ${cand.directory} / ${cand.path}:`, err);
      }
    }

    if (!writtenUri && lastError) {
      throw new Error(lastError?.message || 'تعذر حفظ الصورة في معرض الصور');
    }

    return {
      success: true,
      dataUrl,
      fileUri: writtenUri || undefined,
      filename: uniqueFilename,
      isNative: true,
    };
  }

  try {
    downloadInBrowser(dataUrl, uniqueFilename);
    return {
      success: true,
      dataUrl,
      filename: uniqueFilename,
      isNative: false,
    };
  } catch (err: any) {
    return {
      success: false,
      filename: uniqueFilename,
      isNative: false,
      error: err?.message || 'فشل تحميل الصورة في المتصفح',
    };
  }
}

/**
 * Saves multiple images sequentially (e.g. for multi-page story).
 */
export async function saveOrDownloadMultipleImages(
  items: Array<{ dataUrl: string; filename: string }>
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];
  for (const it of items) {
    const res = await saveOrDownloadImage(it.dataUrl, it.filename);
    results.push(res);
  }
  return results;
}

/**
 * Triggers standard browser file download via anchor link.
 */
export function downloadInBrowser(dataUrl: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (link.parentNode) {
      document.body.removeChild(link);
    }
  }, 200);
}

/**
 * Shares the exported schedule image via Capacitor Share (Android) or Web Share API.
 */
export async function shareExportedSchedule(
  fileUriOrDataUrl: string,
  filename: string,
  title: string
): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: `جدول المواعيد (${title}) - ازبطها`,
          text: `جدول المواعيد (${title}) - تطبيق ازبطها`,
          url: fileUriOrDataUrl,
          dialogTitle: 'مشاركة جدول المواعيد',
        });
        return true;
      }
    } catch (shareErr) {
      console.warn('Native share cancelled or failed:', shareErr);
    }
  } else if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const res = await fetch(fileUriOrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `جدول المواعيد (${title}) - ازبطها`,
          text: `جدول المواعيد (${title}) - تطبيق ازبطها`,
          files: [file],
        });
        return true;
      }
    } catch {
      // Cancelled or unsupported
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Filename Standard Generators
// ---------------------------------------------------------------------------

export function getWeeklyExportFilename(startDateStr?: string, endDateStr?: string): string {
  const safeStart = startDateStr?.trim() || new Date().toISOString().slice(0, 10);
  const safeEnd = endDateStr?.trim() || safeStart;
  return `azbotha-week-${safeStart}-to-${safeEnd}.png`;
}

export function getMonthlyExportFilename(dateOrMonthStr?: string): string {
  if (!dateOrMonthStr) {
    const today = new Date().toISOString().slice(0, 7);
    return `azbotha-month-${today}.png`;
  }
  const ym = dateOrMonthStr.slice(0, 7);
  return `azbotha-month-${ym}.png`;
}

export function getTimetableExportFilename(dateStr?: string): string {
  const safeDate = dateStr?.trim() || new Date().toISOString().slice(0, 10);
  return `azbotha-timetable-${safeDate}.png`;
}

export function getStoryExportFilename(dateStr?: string, pageNumber: number = 1): string {
  const safeDate = dateStr?.trim() || new Date().toISOString().slice(0, 10);
  return `azbotha-day-${safeDate}-${pageNumber}.png`;
}

export function getCoursesExportFilename(dateStr?: string): string {
  const safeDate = dateStr?.trim() || new Date().toISOString().slice(0, 10);
  return `azbotha-courses-${safeDate}.png`;
}

export function getUpcomingExportFilename(dateStr?: string): string {
  const safeDate = dateStr?.trim() || new Date().toISOString().slice(0, 10);
  return `azbotha-upcoming-${safeDate}.png`;
}

export function getSummaryExportFilename(dateStr?: string): string {
  const safeDate = dateStr?.trim() || new Date().toISOString().slice(0, 10);
  return `azbotha-summary-${safeDate}.png`;
}
