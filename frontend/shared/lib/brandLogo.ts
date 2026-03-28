/** يضيف معامل تجنب الكاش عند تغيّر السجل في DB (مثل updated_at). */
export function brandLogoSrc(logoUrl: string | null | undefined, updatedAt?: string | null): string | undefined {
  if (!logoUrl?.trim()) return undefined;
  if (!updatedAt) return logoUrl.trim();
  const sep = logoUrl.includes('?') ? '&' : '?';
  return `${logoUrl.trim()}${sep}v=${encodeURIComponent(updatedAt)}`;
}
