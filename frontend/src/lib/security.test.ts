import { describe, expect, it } from 'vitest';
import { escapeHtml } from './security';

describe('escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml(`<a href="x">y</a> & ' "`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;y&lt;/a&gt; &amp; &#39; &quot;'
    );
  });

  it('handles null and undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('stringifies numbers', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
