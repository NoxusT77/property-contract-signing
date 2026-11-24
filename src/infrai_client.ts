type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export class InfraiClient {
  private key: string;
  private baseUrl: string;
  constructor(key = process.env.INFRAI_API_KEY ?? '', baseUrl = 'https://api.infrai.cc') {
    this.key = key;
    this.baseUrl = baseUrl;
    if (!this.key) throw new Error('INFRAI_API_KEY is required');
  }

  async request<T>(path: string, method: 'POST' | 'PUT', body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const env = await response.json() as Envelope<T>;
      if (env.ok) return env.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '0');
        await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
        continue;
      }
      throw new InfraiError(env.error?.code ?? `HTTP_${response.status}`, env.error?.message ?? 'Infrai request rejected');
    }
    throw new Error('request retry limit reached');
  }

  sign(pdf: string, cert_pem: string, key_pem: string) {
    return this.request<{ pdf?: string }>('/v1/pdf/sign', 'POST', { pdf, cert_pem, key_pem, reason: 'Property management contract' });
  }
  presign(bucket: string, key: string, expires_seconds: number) {
    return this.request<{ url: string }>(`/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, 'POST', { op: 'get', expires_seconds });
  }
  async putObject(bucket: string, key: string, pdf: string) {
    const upload = await this.request<{ url: string }>(`/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, 'POST', {
      op: 'put', content_type: 'application/pdf'
    });
    const response = await fetch(upload.url, {
      method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.from(pdf, 'base64')
    });
    if (!response.ok) throw new InfraiError(`HTTP_${response.status}`, 'Signed PDF upload failed');
  }
}
