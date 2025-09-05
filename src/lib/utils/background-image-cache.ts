import { TIME, URLs } from '@/lib/config';
import type { Report } from '@/lib/types/core';
import type { Cloudflare } from '../../../worker-configuration';
import { OpenRouterImageService } from '@/lib/openrouter-image-service';

const IMAGE_RETENTION_SECONDS = TIME.WEEK_SEC;

function buildKey(reportId: string) {
  return `backgrounds/${reportId}.jpg`;
}

async function decodeDataUrl(dataUrl: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) return null;
    const [, contentType, base64] = match;
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return { buffer: bytes.buffer, contentType };
  } catch {
    return null;
  }
}

export async function getExistingBackgroundUrl(env: Cloudflare.Env, reportId: string): Promise<string | null> {
  try {
    if (!env.INSTAGRAM_IMAGES || !env.R2_PUBLIC_URL) return null;
    const key = buildKey(reportId);
    const head = await env.INSTAGRAM_IMAGES.head(key);
    if (!head) return null;
    return `${env.R2_PUBLIC_URL}/${key}`;
  } catch {
    return null;
  }
}

export async function getOrCreateBackgroundUrl(
  env: Cloudflare.Env,
  imageService: OpenRouterImageService,
  report: Report
): Promise<string> {
  const fallback = URLs.BRAIN_IMAGE;

  // 1) Try existing
  const existing = await getExistingBackgroundUrl(env, report.reportId);
  if (existing) return existing;

  // 2) Generate via OpenRouter once and cache to R2
  try {
    const imageUrl = await imageService.generateNewsBackground(report.headline, report.city);

    let arrayBuffer: ArrayBuffer | null = null;
    let contentType = 'image/jpeg';

    if (imageUrl.startsWith('data:')) {
      const decoded = await decodeDataUrl(imageUrl);
      if (!decoded) throw new Error('Invalid data URL from generator');
      arrayBuffer = decoded.buffer;
      contentType = decoded.contentType || 'image/jpeg';
    } else {
      const resp = await fetch(imageUrl);
      if (!resp.ok) throw new Error(`Fetch background failed: ${resp.status}`);
      arrayBuffer = await resp.arrayBuffer();
      const ct = resp.headers.get('content-type');
      if (ct) contentType = ct;
    }

    const key = buildKey(report.reportId);
    await env.INSTAGRAM_IMAGES.put(key, arrayBuffer, {
      httpMetadata: {
        contentType,
        cacheControl: `public, max-age=${IMAGE_RETENTION_SECONDS}`,
      },
      customMetadata: {
        reportId: report.reportId,
        headline: report.headline,
        city: report.city,
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + IMAGE_RETENTION_SECONDS * 1000).toISOString(),
        source: 'openrouter',
      },
    });

    return `${env.R2_PUBLIC_URL}/${key}`;
  } catch (e) {
    console.warn('[BACKGROUND] Generation/cache failed, using fallback:', e);
    return fallback;
  }
}

