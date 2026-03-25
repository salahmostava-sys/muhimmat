/**
 * Escapes HTML special characters to prevent XSS when interpolating
 * user-controlled data into raw HTML strings (e.g. document.write / print windows).
 *
 * React JSX automatically escapes content, so this is only needed for
 * manual HTML template literals written to document.write() or similar APIs.
 */
export function escapeHtml(value: unknown): string {
  const str = value == null ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
