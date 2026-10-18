import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import dns from 'node:dns/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import {
  validateMediaUrl,
  isPrivateOrReservedHost,
  detectPlatform,
  getDirectExtensionInfo,
  buildVerifiedStreamOptions
} from './src/utils/mediaValidator.ts';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_DOWNLOAD_BYTES = Number(process.env.MAX_DOWNLOAD_BYTES) || 150 * 1024 * 1024; // 150 MB
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 15000;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 60;

let ffprobeAvailable = false;

async function checkFfprobeAvailability() {
  try {
    await execFileAsync('ffprobe', ['-version'], { timeout: 3000 });
    ffprobeAvailable = true;
  } catch {
    ffprobeAvailable = false;
  }
}

// In-memory rate limiting store
interface RateRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (record.resetAt <= now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000).unref();

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || record.resetAt <= now) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  record.count += 1;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000).toString());
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait a moment before sending another request.'
    });
  }

  next();
}

/**
 * Resolves hostname via DNS and verifies no resolved IP is private/reserved (anti-DNS-rebinding SSRF defense).
 */
async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  const validation = validateMediaUrl(rawUrl);
  if (!validation.valid || !validation.sanitizedUrl) {
    throw new Error(validation.error || 'Invalid or unsafe URL.');
  }

  const parsed = new URL(validation.sanitizedUrl);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  if (isPrivateOrReservedHost(hostname)) {
    throw new Error(`Security block (SSRF Protection): Host "${hostname}" is restricted.`);
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      throw new Error(`Could not resolve DNS for hostname "${hostname}".`);
    }
    for (const rec of records) {
      if (isPrivateOrReservedHost(rec.address)) {
        throw new Error(
          `Security block (SSRF Protection): Domain "${hostname}" resolves to a restricted internal IP address.`
        );
      }
    }
  } catch (err: any) {
    if (err.message?.includes('Security block')) {
      throw err;
    }
    throw new Error(`Unable to resolve host "${hostname}" (${err.code || 'DNS_ERROR'}). Check that the domain is spelled correctly and online.`);
  }

  return parsed;
}

/**
 * Performs a safe HTTP fetch with manual redirect verification so a public URL cannot redirect to localhost or private IPs.
 */
async function safeFetchWithRedirects(
  initialUrl: string,
  init: RequestInit,
  maxRedirects = 5
): Promise<{ response: globalThis.Response; finalUrl: string }> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safeParsed = await assertSafeExternalUrl(currentUrl);
    const response = await fetch(safeParsed.toString(), {
      ...init,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KunuMediaDownloader/1.0)',
        Accept: '*/*',
        ...(init.headers || {})
      }
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      if (!location) {
        throw new Error(`Upstream server returned redirect (HTTP ${response.status}) without a Location header.`);
      }
      const nextUrl = new URL(location, safeParsed).toString();
      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: safeParsed.toString() };
  }

  throw new Error('Too many redirects from upstream media server (max 5 allowed).');
}

/**
 * Attempts public oEmbed metadata lookup for platforms that provide official public oEmbed endpoints.
 */
async function fetchPublicOEmbedMetadata(
  targetUrl: string,
  platformId: string
): Promise<{
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
  providerName?: string;
} | null> {
  const oembedEndpoints: Record<string, string> = {
    youtube: `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`,
    vimeo: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(targetUrl)}`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`,
    dailymotion: `https://www.dailymotion.com/services/oembed?url=${encodeURIComponent(targetUrl)}&format=json`
  };

  const endpoint = oembedEndpoints[platformId];
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const { response } = await safeFetchWithRedirects(endpoint, {
      method: 'GET',
      signal: controller.signal
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, any>;
    return {
      title: typeof data.title === 'string' ? data.title : undefined,
      authorName: typeof data.author_name === 'string' ? data.author_name : undefined,
      thumbnailUrl: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined,
      providerName: typeof data.provider_name === 'string' ? data.provider_name : undefined
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Probes actual media stream dimensions and duration via ffprobe when available.
 */
async function probeRemoteMediaDimensions(safeUrl: string): Promise<{
  width?: number;
  height?: number;
  durationSec?: number;
} | null> {
  if (!ffprobeAvailable) return null;
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v', 'error',
        '-rw_timeout', '5000000',
        '-show_entries', 'stream=codec_type,width,height:format=duration',
        '-of', 'json',
        safeUrl
      ],
      { timeout: 6000 }
    );
    const parsed = JSON.parse(stdout);
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const videoStream = streams.find((s: any) => s.codec_type === 'video' && s.width && s.height);
    const durationRaw = parsed?.format?.duration ? Number(parsed.format.duration) : undefined;
    return {
      width: videoStream ? Number(videoStream.width) : undefined,
      height: videoStream ? Number(videoStream.height) : undefined,
      durationSec: durationRaw && Number.isFinite(durationRaw) ? Math.round(durationRaw) : undefined
    };
  } catch {
    return null;
  }
}

function describeUpstreamHttpError(status: number, statusText: string, hostname: string): string {
  if (status === 401 || status === 403) {
    return `Access denied by ${hostname} (HTTP ${status}). The media URL may be expired, private, geo-restricted, or require authentication headers.`;
  }
  if (status === 404 || status === 410) {
    return `Media file not found or link has expired on ${hostname} (HTTP ${status}). Verify the URL is still active.`;
  }
  if (status === 429) {
    return `Upstream server ${hostname} is rate-limiting requests (HTTP 429). Please try again later.`;
  }
  return `Upstream server ${hostname} returned HTTP ${status} (${statusText || 'Error'}). Verify the link points to a publicly accessible media file.`;
}

async function startServer() {
  await checkFfprobeAvailability();

  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Server capabilities endpoint
  app.get('/api/capabilities', (_req: Request, res: Response) => {
    res.json({
      ffprobeAvailable,
      maxDownloadBytes: MAX_DOWNLOAD_BYTES,
      upstreamTimeoutMs: UPSTREAM_TIMEOUT_MS
    });
  });

  // Analyze Media Endpoint — inspects the actual user-supplied URL without substituting any demo/sample media
  app.post('/api/analyze', rateLimiter, async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

    const validation = validateMediaUrl(rawUrl);
    if (!validation.valid || !validation.sanitizedUrl) {
      return res.status(400).json({
        error: validation.error || 'Invalid URL.',
        errorCode: validation.errorCode || 'INVALID_URL'
      });
    }

    const sanitizedUrl = validation.sanitizedUrl;
    const platform = detectPlatform(sanitizedUrl);
    const extInfo = getDirectExtensionInfo(sanitizedUrl);

    // If the URL is a known platform webpage (YouTube, Instagram, Facebook, WhatsApp, X, TikTok, etc.) and not a direct file link
    if (platform.supportStatus !== 'direct_supported' && !extInfo) {
      const oembed = await fetchPublicOEmbedMetadata(sanitizedUrl, platform.id);
      return res.json({
        url: sanitizedUrl,
        finalUrl: sanitizedUrl,
        platform,
        canDirectDownload: false,
        title: oembed?.title || `${platform.name} Link (${new URL(sanitizedUrl).pathname})`,
        authorName: oembed?.authorName,
        thumbnailUrl: oembed?.thumbnailUrl,
        mimeType: 'text/html',
        sizeBytes: null,
        acceptRanges: false,
        corsDirectSupported: false,
        streamOptions: [],
        limitationExplanation: platform.technicalLimitation,
        supportedAlternative: platform.supportedAlternative
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      let headRes: globalThis.Response;
      let finalUrl = sanitizedUrl;

      try {
        const headAttempt = await safeFetchWithRedirects(sanitizedUrl, {
          method: 'HEAD',
          signal: controller.signal
        });
        headRes = headAttempt.response;
        finalUrl = headAttempt.finalUrl;

        // Many CDNs or signed object storage URLs disallow HEAD and require a ranged GET
        if (!headRes.ok && [400, 403, 404, 405, 501].includes(headRes.status)) {
          const getAttempt = await safeFetchWithRedirects(sanitizedUrl, {
            method: 'GET',
            headers: { Range: 'bytes=0-1023' },
            signal: controller.signal
          });
          headRes = getAttempt.response;
          finalUrl = getAttempt.finalUrl;
          await headRes.body?.cancel().catch(() => {});
        }
      } catch (err: any) {
        const isTimeout = err.name === 'AbortError';
        return res.status(400).json({
          error: isTimeout
            ? `Connection to upstream media server timed out after ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)} seconds.`
            : err.message || 'Failed to connect to upstream media server.',
          errorCode: err.message?.includes('SSRF') ? 'SSRF_BLOCKED' : 'UPSTREAM_ERROR'
        });
      }

      const finalHost = new URL(finalUrl).hostname;

      // Re-check platform after redirects in case a shortlink redirected to YouTube/Instagram/etc.
      const redirectedPlatform = detectPlatform(finalUrl);
      const redirectedExtInfo = getDirectExtensionInfo(finalUrl);

      if (!headRes.ok && headRes.status !== 206) {
        return res.status(400).json({
          error: describeUpstreamHttpError(headRes.status, headRes.statusText, finalHost),
          errorCode: 'UPSTREAM_HTTP_ERROR'
        });
      }

      const contentType = (headRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const contentRange = headRes.headers.get('content-range');
      let sizeBytes: number | null = null;

      if (contentRange && contentRange.includes('/')) {
        const totalPart = Number(contentRange.split('/')[1]);
        if (!Number.isNaN(totalPart) && totalPart > 0) {
          sizeBytes = totalPart;
        }
      }
      if (sizeBytes === null) {
        const cl = headRes.headers.get('content-length');
        if (cl && !Number.isNaN(Number(cl)) && Number(cl) > 0 && headRes.status !== 206) {
          sizeBytes = Number(cl);
        }
      }

      const acceptRanges = headRes.headers.get('accept-ranges') === 'bytes' || Boolean(contentRange);
      const accessControl = headRes.headers.get('access-control-allow-origin');
      const corsDirectSupported = accessControl === '*' || Boolean(accessControl);

      const activeExtInfo = redirectedExtInfo || extInfo;

      // Explicitly reject HTML, JSON, plain text, or XML responses even if the URL had an extension
      const isNonMediaDocument =
        contentType.startsWith('text/') ||
        contentType === 'application/json' ||
        contentType === 'application/xml' ||
        contentType === 'application/xhtml+xml';

      const isMediaMime =
        !isNonMediaDocument &&
        (contentType.startsWith('video/') ||
          contentType.startsWith('audio/') ||
          contentType === 'application/ogg' ||
          ((contentType === 'application/octet-stream' || contentType === 'binary/octet-stream' || !contentType) &&
            Boolean(activeExtInfo)));

      if (!isMediaMime) {
        const oembed =
          redirectedPlatform.supportStatus !== 'direct_supported'
            ? await fetchPublicOEmbedMetadata(finalUrl, redirectedPlatform.id)
            : null;

        return res.json({
          url: sanitizedUrl,
          finalUrl,
          platform: redirectedPlatform,
          canDirectDownload: false,
          title: oembed?.title || `${finalHost}${new URL(finalUrl).pathname}`,
          authorName: oembed?.authorName,
          thumbnailUrl: oembed?.thumbnailUrl,
          mimeType: contentType || 'text/html',
          sizeBytes,
          acceptRanges: false,
          corsDirectSupported: false,
          streamOptions: [],
          limitationExplanation:
            redirectedPlatform.supportStatus !== 'direct_supported'
              ? redirectedPlatform.technicalLimitation
              : `The URL returned "${contentType || 'text/html'}" (a webpage or non-media document) rather than a direct video or audio file stream. Kunu Media Downloader does not scrape webpages or bypass platform extraction protections.`,
          supportedAlternative:
            redirectedPlatform.supportStatus !== 'direct_supported'
              ? redirectedPlatform.supportedAlternative
              : 'Provide a direct link pointing to an actual .mp4, .webm, .mp3, .wav, .ogg, or .m4a media stream.'
        });
      }

      const resolvedMime =
        contentType.startsWith('video/') || contentType.startsWith('audio/') || contentType === 'application/ogg'
          ? contentType === 'application/ogg'
            ? 'audio/ogg'
            : contentType
          : activeExtInfo?.mimeType || 'video/mp4';

      const urlPathParts = new URL(finalUrl).pathname.split('/').filter(Boolean);
      const rawFilename = decodeURIComponent(urlPathParts[urlPathParts.length - 1] || 'media-file');

      // Probe real dimensions from the actual remote stream if it is a video and ffprobe is available
      const probed = resolvedMime.startsWith('video/') ? await probeRemoteMediaDimensions(finalUrl) : null;

      const streamOptions = buildVerifiedStreamOptions({
        directUrl: finalUrl,
        mimeType: resolvedMime,
        sizeBytes,
        videoWidth: probed?.width ?? null,
        videoHeight: probed?.height ?? null
      });

      return res.json({
        url: sanitizedUrl,
        finalUrl,
        platform: redirectedPlatform,
        canDirectDownload: true,
        title: rawFilename,
        mimeType: resolvedMime,
        sizeBytes,
        videoWidth: probed?.width,
        videoHeight: probed?.height,
        durationSec: probed?.durationSec,
        acceptRanges,
        corsDirectSupported,
        streamOptions,
        notice:
          sizeBytes && sizeBytes > MAX_DOWNLOAD_BYTES
            ? `File size exceeds backend proxy limit (${Math.round(MAX_DOWNLOAD_BYTES / 1024 / 1024)} MB). Direct browser download will be used.`
            : 'Verified direct media stream from the supplied source URL.'
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  // Safe Backend Streaming Proxy Endpoint for Preview (inline=1 with Range support) and Download
  app.get('/api/stream', rateLimiter, async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const requestedFilename = typeof req.query.filename === 'string' ? req.query.filename.trim() : '';
    const isInlinePreview = req.query.inline === '1';

    const validation = validateMediaUrl(rawUrl);
    if (!validation.valid || !validation.sanitizedUrl) {
      return res.status(400).json({
        error: validation.error || 'Invalid or unsafe media URL.'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    req.on('close', () => {
      controller.abort();
    });

    try {
      const upstreamHeaders: Record<string, string> = {};
      if (typeof req.headers.range === 'string') {
        upstreamHeaders['Range'] = req.headers.range;
      }

      const { response: upstreamRes, finalUrl } = await safeFetchWithRedirects(validation.sanitizedUrl, {
        method: 'GET',
        headers: upstreamHeaders,
        signal: controller.signal
      });

      clearTimeout(timeout);

      const finalHost = new URL(finalUrl).hostname;

      if ((!upstreamRes.ok && upstreamRes.status !== 206) || !upstreamRes.body) {
        await upstreamRes.body?.cancel().catch(() => {});
        return res.status(upstreamRes.status >= 400 ? upstreamRes.status : 400).json({
          error: describeUpstreamHttpError(upstreamRes.status, upstreamRes.statusText, finalHost)
        });
      }

      const contentType = (upstreamRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const extInfo = getDirectExtensionInfo(finalUrl);

      const isNonMediaDocument =
        contentType.startsWith('text/') ||
        contentType === 'application/json' ||
        contentType === 'application/xml' ||
        contentType === 'application/xhtml+xml';

      const isAllowedMedia =
        !isNonMediaDocument &&
        (contentType.startsWith('video/') ||
          contentType.startsWith('audio/') ||
          contentType === 'application/ogg' ||
          ((contentType === 'application/octet-stream' || contentType === 'binary/octet-stream' || !contentType) &&
            Boolean(extInfo)));

      if (!isAllowedMedia) {
        await upstreamRes.body.cancel().catch(() => {});
        return res.status(400).json({
          error: `Upstream URL returned non-media content-type "${contentType || 'unknown'}". Only direct video and audio files can be streamed.`
        });
      }

      const contentLengthHeader = upstreamRes.headers.get('content-length');
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
      if (contentLength && contentLength > MAX_DOWNLOAD_BYTES) {
        await upstreamRes.body.cancel().catch(() => {});
        return res.status(413).json({
          error: `File size (${Math.round(contentLength / 1024 / 1024)} MB) exceeds maximum proxy limit (${Math.round(MAX_DOWNLOAD_BYTES / 1024 / 1024)} MB).`
        });
      }

      const fallbackName = decodeURIComponent(new URL(finalUrl).pathname.split('/').pop() || 'media-download');
      const safeFilename = (requestedFilename || fallbackName).replace(/[^a-zA-Z0-9._-]/g, '_');

      const resolvedMime =
        contentType.startsWith('video/') || contentType.startsWith('audio/') || contentType === 'application/ogg'
          ? contentType === 'application/ogg'
            ? 'audio/ogg'
            : contentType
          : extInfo?.mimeType || 'application/octet-stream';

      res.status(upstreamRes.status === 206 ? 206 : 200);
      res.setHeader('Content-Type', resolvedMime);
      res.setHeader(
        'Content-Disposition',
        isInlinePreview ? `inline; filename="${safeFilename}"` : `attachment; filename="${safeFilename}"`
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const acceptRanges = upstreamRes.headers.get('accept-ranges');
      if (acceptRanges) {
        res.setHeader('Accept-Ranges', acceptRanges);
      } else {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      const contentRange = upstreamRes.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }

      if (contentLength !== null && !Number.isNaN(contentLength)) {
        res.setHeader('Content-Length', contentLength.toString());
      }

      const nodeStream = Readable.fromWeb(upstreamRes.body as any);
      let bytesTransferred = 0;

      nodeStream.on('data', (chunk: Buffer) => {
        bytesTransferred += chunk.length;
        if (bytesTransferred > MAX_DOWNLOAD_BYTES) {
          nodeStream.destroy(new Error('Maximum download byte limit exceeded.'));
          res.destroy();
        }
      });

      nodeStream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Upstream media stream was interrupted.' });
        } else {
          res.end();
        }
      });

      nodeStream.pipe(res);
    } catch (err: any) {
      clearTimeout(timeout);
      if (!res.headersSent) {
        const isTimeout = err.name === 'AbortError';
        res.status(400).json({
          error: isTimeout
            ? 'Upstream media server timed out while opening stream.'
            : err.message || 'Streaming failed.'
        });
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kunu Media Downloader server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
