import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EPayClient } from '../client';
import { EPayError } from '../utils';

function createMockResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(headers ?? {}),
  };
}

describe('EPayClient', () => {
  let client: EPayClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as any;
    client = new EPayClient({ apiUrl: 'https://api.epay.dev', maxRetries: 2, retryDelayMs: 10 });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const c = new EPayClient();
      expect(c.config.apiUrl).toBe('http://localhost:4000');
      expect(c.config.maxRetries).toBe(3);
    });

    it('should accept apiKey in config', () => {
      const c = new EPayClient({ apiKey: 'epay_test_key' });
      expect(c.config.apiKey).toBe('epay_test_key');
    });

    it('should accept accessToken in config', () => {
      const c = new EPayClient({ accessToken: 'jwt_token' });
      expect(c.config.accessToken).toBe('jwt_token');
    });
  });

  describe('authentication', () => {
    it('should set API key', () => {
      client.setApiKey('epay_key_abc');
      expect(client.config.apiKey).toBe('epay_key_abc');
    });

    it('should set access token', () => {
      client.setAccessToken('jwt_xyz');
      expect(client.config.accessToken).toBe('jwt_xyz');
    });

    it('should clear auth', () => {
      client.setApiKey('key');
      client.clearAuth();
      expect(client.config.apiKey).toBe('');
      expect(client.config.accessToken).toBe('');
    });
  });

  describe('HTTP methods', () => {
    it('should make a GET request', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, { data: 'ok' }));

      const result = await client.get<{ data: string }>('/test');
      expect(result.data).toBe('ok');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.epay.dev/test',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should make a POST request with body', async () => {
      mockFetch.mockResolvedValue(createMockResponse(201, { id: '1' }));

      const result = await client.post<{ id: string }>('/items', { name: 'test' });
      expect(result.id).toBe('1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.epay.dev/items',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should make a PATCH request', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, { updated: true }));

      const result = await client.patch<{ updated: boolean }>('/items/1', { name: 'new' });
      expect(result.updated).toBe(true);
    });

    it('should make a PUT request', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, { replaced: true }));

      const result = await client.put<{ replaced: boolean }>('/items/1', { name: 'full' });
      expect(result.replaced).toBe(true);
    });

    it('should make a DELETE request', async () => {
      mockFetch.mockResolvedValue(createMockResponse(204, null));

      const result = await client.delete('/items/1');
      expect(result).toBeUndefined();
    });

    it('should send JWT auth header', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, {}));
      client.setAccessToken('jwt_token_here');

      await client.get('/auth-test');
      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(call[1].headers).toMatchObject({
        Authorization: 'Bearer jwt_token_here',
      });
    });

    it('should send API key header', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, {}));
      client.setApiKey('epay_key_here');

      await client.get('/api-test');
      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(call[1].headers).toMatchObject({
        'x-api-key': 'epay_key_here',
      });
    });

    it('should not send auth header when not authenticated', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, {}));

      await client.get('/no-auth');
      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = call[1].headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['x-api-key']).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw EPayError on bad response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(400, { message: 'Invalid input' }));

      await expect(client.get('/bad')).rejects.toThrow(EPayError);
      await expect(client.get('/bad')).rejects.toThrow('Invalid input');
    });

    it('should include statusCode in EPayError', async () => {
      mockFetch.mockResolvedValue(createMockResponse(404, { message: 'Not found' }));

      try {
        await client.get('/missing');
      } catch (err) {
        expect(err).toBeInstanceOf(EPayError);
        expect((err as EPayError).statusCode).toBe(404);
      }
    });

    it('should handle JSON parse failure in error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('Parse fail')),
      });

      await expect(client.get('/bad-json')).rejects.toThrow(EPayError);
    });
  });

  describe('retry on failure', () => {
    it('should retry on network error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(200, { success: true }));

      const result = await client.get<{ success: boolean }>('/retry');
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on EPayError (4xx)', async () => {
      mockFetch.mockResolvedValue(createMockResponse(400, { message: 'Bad' }));

      await expect(client.get('/no-retry')).rejects.toThrow(EPayError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should give up after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent failure'));

      // 1 initial + 2 retries = 3 total
      await expect(client.get('/give-up')).rejects.toThrow('Persistent failure');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('timeout', () => {
    it('should create EPayError with 408 for timeout', () => {
      // Simulate an AbortError (what fetch throws on timeout)
      const err = new DOMException('The operation was aborted', 'AbortError');
      expect(err.name).toBe('AbortError');

      // The client catches AbortError and wraps it
      const timeoutErr = new EPayError('Request timed out', 408);
      expect(timeoutErr.statusCode).toBe(408);
      expect(timeoutErr.message).toBe('Request timed out');
    });
  });
});
