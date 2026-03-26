import { afterEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@shared/test/msw/server';
import { sendWhatsAppMessage } from './whatsapp';

const API_BASE = 'https://graph.facebook.com/v19.0';

describe('sendWhatsAppMessage (MSW)', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('returns false when config is missing', async () => {
    const result = await sendWhatsAppMessage('055 123 4567', 'hello');
    expect(result).toBe(false);
  });

  it('returns true for 2xx response and sends normalized phone', async () => {
    localStorage.setItem(
      'whatsapp_config',
      JSON.stringify({
        token: 'test-token',
        phone_number_id: '12345',
        enabled: true,
      })
    );

    let sentTo = '';
    server.use(
      http.post(`${API_BASE}/12345/messages`, async ({ request }) => {
        const body = (await request.json()) as { to?: string };
        sentTo = body.to || '';
        return HttpResponse.json({ success: true }, { status: 200 });
      })
    );

    const result = await sendWhatsAppMessage('055-123 (4567)', 'hello');
    expect(result).toBe(true);
    expect(sentTo).toBe('551234567');
  });

  it('returns false for non-2xx response', async () => {
    localStorage.setItem(
      'whatsapp_config',
      JSON.stringify({
        token: 'test-token',
        phone_number_id: '12345',
        enabled: true,
      })
    );

    server.use(
      http.post(`${API_BASE}/12345/messages`, () => {
        return HttpResponse.json({ error: 'bad request' }, { status: 400 });
      })
    );

    const result = await sendWhatsAppMessage('0551234567', 'hello');
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    localStorage.setItem(
      'whatsapp_config',
      JSON.stringify({
        token: 'test-token',
        phone_number_id: '12345',
        enabled: true,
      })
    );

    server.use(
      http.post(`${API_BASE}/12345/messages`, () => {
        return HttpResponse.error();
      })
    );

    const result = await sendWhatsAppMessage('0551234567', 'hello');
    expect(result).toBe(false);
  });
});
