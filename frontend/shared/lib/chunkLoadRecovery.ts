/** بعد نشر نسخة جديدة قد يطلب المتصفح chunk قديمًا — إعادة تحميل الصفحة مرة واحدة تجلب `index.html` وأسماء الملفات الصحيحة. */

const CHUNK_RELOAD_KEY = '__chunk_reload_once__';

export function isLikelyStaleChunkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('dynamically imported module') ||
    m.includes('chunkloaderror') ||
    m.includes('loading chunk') ||
    m.includes('importing a module script failed')
  );
}

/** يعيد تحميل الصفحة مرة واحدة لكل جلسة إن لم تُجرَ محاولة سابقة. يعيد `true` إذا بدأ التحميل. */
export function reloadOnceForStaleChunk(): boolean {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      return false;
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    }
  } catch {
    /* ignore */
  }
  globalThis.location.reload();
  return true;
}
