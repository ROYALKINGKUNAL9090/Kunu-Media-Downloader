import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import dns from 'node:dns/promises';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import {
  validateMediaUrl,
  isPrivateOrReservedHost,
  detectPlatform,
  getDirectExtensionInfo,
  buildVerifiedStreamOptions,
  mapHeightToQualityLabel,
  AvailableStreamOption,
  QualityLabel,
  AudioFormatLabel
} from './src/utils/mediaValidator.ts';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_DOWNLOAD_BYTES = Number(process.env.MAX_DOWNLOAD_BYTES) || 150 * 1024 * 1024; // 150 MB
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 15000;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 60;

// Temp folder for safe media operations with automatic cleanup
const TEMP_DIR = path.join(os.tmpdir(), 'kunu-media-downloader-tmp');

let ffmpegAvailable = false;
let sampleMp4Path = '';
let sampleMp4Size = 0;

async function initMediaEnvironment() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    await execFileAsync('ffmpeg', ['-version'], { timeout: 4000 });
    ffmpegAvailable = true;

    // Generate a real, open-licensed 1280x720 HD MP4 sample video with stereo audio so users can test real video & audio downloading immediately
    sampleMp4Path = path.join(TEMP_DIR, 'cosmos-hd.mp4');
    if (!existsSync(sampleMp4Path)) {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-f', 'lavfi',
          '-i', 'testsrc2=size=1280x720:rate=24:duration=4',
          '-f', 'lavfi',
          '-i', 'sine=frequency=440:sample_rate=44100:duration=4',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          sampleMp4Path
        ],
        { timeout: 15000 }
      );
    }
    const stat = await fs.stat(sampleMp4Path);
    sampleMp4Size = stat.size;
  } catch {
    ffmpegAvailable = false;
  }
}

// Periodic cleanup of any temp files older than 5 minutes
setInterval(async () => {
  try {
    const entries = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    for (const entry of entries) {
      if (entry === 'cosmos-hd.mp4') continue;
      const fullPath = path.join(TEMP_DIR, entry);
      const st = await fs.stat(fullPath).catch(() => null);
      if (st && now - st.mtimeMs > 5 * 60 * 1000) {
        await fs.rm(fullPath, { force: true }).catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}, 60000).unref();

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
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
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
 * Generates a real, standards-compliant stereo 44.1kHz 16-bit PCM WAV buffer.
 */
function generateSampleWavBuffer(durationSec = 3, baseFreq = 440): Buffer {
  const sampleRate = 44100;
  const numChannels = 2;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 8) * Math.exp(-t * 0.9);
    const waveL =
      0.4 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.25 * Math.sin(2 * Math.PI * (baseFreq * 1.25) * t) +
      0.2 * Math.sin(2 * Math.PI * (baseFreq * 1.5) * t);
    const waveR =
      0.4 * Math.sin(2 * Math.PI * (baseFreq * 1.002) * t) +
      0.25 * Math.sin(2 * Math.PI * (baseFreq * 1.25) * t) +
      0.2 * Math.sin(2 * Math.PI * (baseFreq * 2) * t);

    const sampleL = Math.max(-1, Math.min(1, waveL * envelope));
    const sampleR = Math.max(-1, Math.min(1, waveR * envelope));

    buffer.writeInt16LE(Math.floor(sampleL * 32767), offset);
    buffer.writeInt16LE(Math.floor(sampleR * 32767), offset + 2);
    offset += 4;
  }

  return buffer;
}

const SAMPLE_WAV_CHIME = generateSampleWavBuffer(4, 440);
const SAMPLE_WAV_BASS = generateSampleWavBuffer(3, 220);

/**
 * Resolves hostname via DNS and verifies no resolved IP is private/reserved (anti-DNS-rebinding SSRF defense).
 */
async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  const validation = validateMediaUrl(rawUrl, false);
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
    throw new Error(`Unable to resolve host "${hostname}" (${err.code || 'DNS_ERROR'}).`);
  }

  return parsed;
}

/**
 * Performs a safe HTTP fetch with manual redirect verification so a public URL cannot redirect to localhost or 169.254.169.254.
 */
async function safeFetchWithRedirects(
  initialUrl: string,
  init: RequestInit,
  maxRedirects = 3
): Promise<{ response: globalThis.Response; finalUrl: string }> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const safeParsed = await assertSafeExternalUrl(currentUrl);
    const response = await fetch(safeParsed.toString(), {
      ...init,
      redirect: 'manual',
      headers: {
        'User-Agent': 'KunuMediaDownloader/1.0 (+https://github.com/kunu-media-downloader)',
        ...(init.headers || {})
      }
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`Upstream server returned redirect (${response.status}) without a Location header.`);
      }
      const nextUrl = new URL(location, safeParsed).toString();
      currentUrl = nextUrl;
      continue;
    }

    return { response, finalUrl: safeParsed.toString() };
  }

  throw new Error('Too many redirects from upstream media server (max 3 allowed).');
}

/**
 * Attempts public oEmbed metadata lookup for platforms that legally provide public oEmbed endpoints.
 */
async function fetchPublicOEmbedMetadata(targetUrl: string, platformId: string): Promise<{
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
 * Builds verified transcoding/audio extraction options when FFmpeg is installed on the server
 * and never invents resolutions above the actual source height.
 */
function appendVerifiedFfmpegOptions(
  baseOptions: AvailableStreamOption[],
  sourceUrl: string,
  sourceHeight: number | null,
  hasAudioStream: boolean,
  isAudioSource: boolean
): AvailableStreamOption[] {
  if (!ffmpegAvailable) return baseOptions;
  const result = [...baseOptions];

  // Standard ladder tiers only at or below the actual source video height
  if (!isAudioSource && sourceHeight && sourceHeight > 0) {
    const tiers: Array<{ height: number; width: number; label: QualityLabel }> = [
      { height: 2160, width: 3840, label: '2160p 4K' },
      { height: 1440, width: 2560, label: '1440p 2K' },
      { height: 1080, width: 1920, label: '1080p Full HD' },
      { height: 720, width: 1280, label: '720p HD' },
      { height: 480, width: 854, label: '480p' },
      { height: 360, width: 640, label: '360p' },
      { height: 240, width: 426, label: '240p' },
      { height: 144, width: 256, label: '144p' }
    ];

    for (const tier of tiers) {
      if (tier.height <= sourceHeight && !result.some((o) => o.label === tier.label)) {
        result.push({
          id: `ffmpeg-video-${tier.height}p`,
          label: tier.label,
          container: 'MP4',
          mimeType: 'video/mp4',
          isAudioOnly: false,
          resolution: `${tier.width}×${tier.height}`,
          sizeBytes: null,
          directUrl: `/api/convert?url=${encodeURIComponent(sourceUrl)}&format=mp4&height=${tier.height}`,
          verifiedSource: true
        });
      }
    }
  }

  // Audio formats when the source contains an audio track
  if (hasAudioStream || isAudioSource) {
    const audioFormats: Array<{ fmt: string; label: AudioFormatLabel; container: AvailableStreamOption['container']; mime: string }> = [
      { fmt: 'mp3', label: 'MP3', container: 'MP3', mime: 'audio/mpeg' },
      { fmt: 'm4a', label: 'M4A', container: 'M4A', mime: 'audio/mp4' },
      { fmt: 'wav', label: 'WAV', container: 'WAV', mime: 'audio/wav' },
      { fmt: 'ogg', label: 'OGG', container: 'OGG', mime: 'audio/ogg' }
    ];

    for (const af of audioFormats) {
      if (!result.some((o) => o.label === af.label)) {
        result.push({
          id: `ffmpeg-audio-${af.fmt}`,
          label: af.label,
          container: af.container,
          mimeType: af.mime,
          isAudioOnly: true,
          sizeBytes: null,
          directUrl: `/api/convert?url=${encodeURIComponent(sourceUrl)}&format=${af.fmt}`,
          verifiedSource: true
        });
      }
    }
  }

  return result;
}

async function startServer() {
  await initMediaEnvironment();

  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Server capabilities endpoint
  app.get('/api/capabilities', (_req: Request, res: Response) => {
    res.json({
      ffmpegAvailable,
      maxDownloadBytes: MAX_DOWNLOAD_BYTES,
      upstreamTimeoutMs: UPSTREAM_TIMEOUT_MS,
      sampleVideoReady: Boolean(sampleMp4Path && sampleMp4Size > 0)
    });
  });

  // Built-in legal open-licensed sample media endpoints
  app.get('/api/sample-media/:filename', (req: Request, res: Response) => {
    const { filename } = req.params;
    if (filename === 'cosmos-hd.mp4' && sampleMp4Path && existsSync(sampleMp4Path)) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', sampleMp4Size.toString());
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', 'attachment; filename="cosmos-hd-720p.mp4"');
      }
      return createReadStream(sampleMp4Path).pipe(res);
    }
    if (filename === 'synthwave-harmony.wav') {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', SAMPLE_WAV_CHIME.length.toString());
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', 'attachment; filename="synthwave-harmony.wav"');
      }
      return res.send(SAMPLE_WAV_CHIME);
    }
    if (filename === 'deep-ambient-chord.wav') {
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', SAMPLE_WAV_BASS.length.toString());
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', 'attachment; filename="deep-ambient-chord.wav"');
      }
      return res.send(SAMPLE_WAV_BASS);
    }
    return res.status(404).json({ error: 'Sample media file not found.' });
  });

  // Analyze Media Endpoint
  app.post('/api/analyze', rateLimiter, async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

    const validation = validateMediaUrl(rawUrl, true);
    if (!validation.valid || !validation.sanitizedUrl) {
      return res.status(400).json({
        error: validation.error || 'Invalid URL.',
        errorCode: validation.errorCode || 'INVALID_URL'
      });
    }

    const sanitizedUrl = validation.sanitizedUrl;
    const platform = detectPlatform(sanitizedUrl);

    // Handle built-in sample media URLs
    if (sanitizedUrl.startsWith('/api/sample-media/')) {
      if (sanitizedUrl.includes('cosmos-hd.mp4')) {
        const baseOpts = buildVerifiedStreamOptions({
          directUrl: sanitizedUrl,
          mimeType: 'video/mp4',
          sizeBytes: sampleMp4Size,
          videoWidth: 1280,
          videoHeight: 720
        });
        const fullOpts = appendVerifiedFfmpegOptions(baseOpts, sanitizedUrl, 720, true, false);
        return res.json({
          url: sanitizedUrl,
          finalUrl: sanitizedUrl,
          platform,
          canDirectDownload: true,
          title: 'Kunu Studio Cosmos Test Pattern (1280×720 HD MP4)',
          mimeType: 'video/mp4',
          sizeBytes: sampleMp4Size,
          videoWidth: 1280,
          videoHeight: 720,
          durationSec: 4,
          acceptRanges: true,
          corsDirectSupported: true,
          ffmpegAvailable,
          streamOptions: fullOpts,
          notice: 'Verified open-licensed 720p HD MP4 video stream with stereo AAC audio.'
        });
      }

      const isBass = sanitizedUrl.includes('deep-ambient-chord');
      const buf = isBass ? SAMPLE_WAV_BASS : SAMPLE_WAV_CHIME;
      const baseOpts = buildVerifiedStreamOptions({
        directUrl: sanitizedUrl,
        mimeType: 'audio/wav',
        sizeBytes: buf.length
      });
      const fullOpts = appendVerifiedFfmpegOptions(baseOpts, sanitizedUrl, null, true, true);

      return res.json({
        url: sanitizedUrl,
        finalUrl: sanitizedUrl,
        platform,
        canDirectDownload: true,
        title: isBass ? 'Deep Ambient A2 Studio Chord (WAV)' : 'Kunu Studio Harmonic Triad 44.1kHz (WAV)',
        mimeType: 'audio/wav',
        sizeBytes: buf.length,
        durationSec: isBass ? 3 : 4,
        acceptRanges: true,
        corsDirectSupported: true,
        ffmpegAvailable,
        streamOptions: fullOpts,
        notice: 'Verified studio-generated uncompressed PCM WAV audio stream hosted directly on this server.'
      });
    }

    const extInfo = getDirectExtensionInfo(sanitizedUrl);

    if (platform.supportStatus !== 'direct_supported' && !extInfo) {
      const oembed = await fetchPublicOEmbedMetadata(sanitizedUrl, platform.id);
      return res.json({
        url: sanitizedUrl,
        finalUrl: sanitizedUrl,
        platform,
        canDirectDownload: false,
        title: oembed?.title || `${platform.name} Media Link`,
        authorName: oembed?.authorName,
        thumbnailUrl: oembed?.thumbnailUrl,
        mimeType: 'text/html',
        sizeBytes: null,
        acceptRanges: false,
        corsDirectSupported: false,
        ffmpegAvailable,
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

        if (!headRes.ok && (headRes.status === 405 || headRes.status === 403 || headRes.status === 400)) {
          const getAttempt = await safeFetchWithRedirects(sanitizedUrl, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' },
            signal: controller.signal
          });
          headRes = getAttempt.response;
          finalUrl = getAttempt.finalUrl;
          await headRes.body?.cancel().catch(() => {});
        }
      } catch (err: any) {
        return res.status(400).json({
          error: err.message || 'Failed to connect to upstream media server.',
          errorCode: err.message?.includes('SSRF') ? 'SSRF_BLOCKED' : 'UPSTREAM_ERROR'
        });
      }

      if (!headRes.ok && headRes.status !== 206) {
        return res.status(400).json({
          error: `Upstream server returned HTTP ${headRes.status} (${headRes.statusText || 'Error'}). Verify the link is publicly accessible and does not require authentication.`,
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
        if (cl && !Number.isNaN(Number(cl)) && Number(cl) > 0) {
          sizeBytes = Number(cl);
        }
      }

      const acceptRanges = headRes.headers.get('accept-ranges') === 'bytes' || Boolean(contentRange);
      const accessControl = headRes.headers.get('access-control-allow-origin');
      const corsDirectSupported = accessControl === '*' || Boolean(accessControl);

      const isMediaMime =
        contentType.startsWith('video/') ||
        contentType.startsWith('audio/') ||
        contentType === 'application/ogg' ||
        (contentType === 'application/octet-stream' && Boolean(extInfo));

      if (!isMediaMime && !extInfo) {
        return res.json({
          url: sanitizedUrl,
          finalUrl,
          platform,
          canDirectDownload: false,
          title: new URL(finalUrl).hostname + new URL(finalUrl).pathname,
          mimeType: contentType || 'text/html',
          sizeBytes,
          acceptRanges: false,
          corsDirectSupported: false,
          ffmpegAvailable,
          streamOptions: [],
          limitationExplanation: `The URL returned "${contentType || 'text/html'}" instead of a direct video or audio stream. Kunu Media Downloader does not scrape HTML pages or bypass access controls.`,
          supportedAlternative: 'Provide a direct link ending in .mp4, .webm, .mp3, .wav, .ogg, or .m4a, or use one of the verified sample streams.'
        });
      }

      const resolvedMime = isMediaMime
        ? contentType === 'application/octet-stream' && extInfo
          ? extInfo.mimeType
          : contentType
        : extInfo?.mimeType || 'video/mp4';

      const urlPathParts = new URL(finalUrl).pathname.split('/').filter(Boolean);
      const rawFilename = decodeURIComponent(urlPathParts[urlPathParts.length - 1] || 'media-stream');

      const baseOptions = buildVerifiedStreamOptions({
        directUrl: finalUrl,
        mimeType: resolvedMime,
        sizeBytes
      });

      return res.json({
        url: sanitizedUrl,
        finalUrl,
        platform,
        canDirectDownload: true,
        title: rawFilename,
        mimeType: resolvedMime,
        sizeBytes,
        acceptRanges,
        corsDirectSupported,
        ffmpegAvailable,
        streamOptions: baseOptions,
        notice: sizeBytes && sizeBytes > MAX_DOWNLOAD_BYTES
          ? `File size exceeds backend proxy limit (${Math.round(MAX_DOWNLOAD_BYTES / 1024 / 1024)} MB). Direct browser download will be used.`
          : 'Verified direct media stream ready for download.'
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  // Safe Server-Side Media Conversion / Downscaling Endpoint (only when FFmpeg is available and permitted)
  app.get('/api/convert', rateLimiter, async (req: Request, res: Response) => {
    if (!ffmpegAvailable) {
      return res.status(501).json({
        error: 'Server-side media conversion is not available in this hosting environment.'
      });
    }

    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const format = typeof req.query.format === 'string' ? req.query.format.trim().toLowerCase() : 'mp3';
    const targetHeight = req.query.height ? Number(req.query.height) : null;

    const allowedFormats = ['mp4', 'mp3', 'm4a', 'wav', 'ogg'];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ error: `Unsupported target format "${format}".` });
    }

    let inputPathOrUrl = '';
    if (rawUrl.startsWith('/api/sample-media/')) {
      if (rawUrl.includes('cosmos-hd.mp4') && sampleMp4Path) {
        inputPathOrUrl = sampleMp4Path;
      } else {
        const isBass = rawUrl.includes('deep-ambient-chord');
        const tempWav = path.join(TEMP_DIR, `sample-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
        await fs.writeFile(tempWav, isBass ? SAMPLE_WAV_BASS : SAMPLE_WAV_CHIME);
        inputPathOrUrl = tempWav;
      }
    } else {
      try {
        const safeUrl = await assertSafeExternalUrl(rawUrl);
        inputPathOrUrl = safeUrl.toString();
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Unsafe URL blocked.' });
      }
    }

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const outputFilePath = path.join(TEMP_DIR, `out-${jobId}.${format}`);

    try {
      const args: string[] = ['-y', '-i', inputPathOrUrl, '-t', '120']; // cap conversion to 120s for safety

      if (format === 'mp4') {
        const h = targetHeight && [144, 240, 360, 480, 720, 1080, 1440, 2160].includes(targetHeight)
          ? targetHeight
          : 720;
        args.push(
          '-vf', `scale=-2:${h}`,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          outputFilePath
        );
      } else if (format === 'mp3') {
        args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '2', outputFilePath);
      } else if (format === 'm4a') {
        args.push('-vn', '-c:a', 'aac', '-b:a', '192k', outputFilePath);
      } else if (format === 'wav') {
        args.push('-vn', '-c:a', 'pcm_s16le', outputFilePath);
      } else if (format === 'ogg') {
        args.push('-vn', '-c:a', 'libvorbis', '-q:a', '4', outputFilePath);
      }

      await execFileAsync('ffmpeg', args, { timeout: 25000 });

      const stat = await fs.stat(outputFilePath);
      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg'
      };

      const filenameLabel = targetHeight ? `kunu-media-${targetHeight}p.${format}` : `kunu-audio.${format}`;
      res.setHeader('Content-Type', mimeMap[format] || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size.toString());
      res.setHeader('Content-Disposition', `attachment; filename="${filenameLabel}"`);

      const readStream = createReadStream(outputFilePath);
      readStream.on('close', () => {
        fs.rm(outputFilePath, { force: true }).catch(() => {});
        if (inputPathOrUrl.startsWith(TEMP_DIR) && inputPathOrUrl !== sampleMp4Path) {
          fs.rm(inputPathOrUrl, { force: true }).catch(() => {});
        }
      });
      readStream.pipe(res);
    } catch (err: any) {
      await fs.rm(outputFilePath, { force: true }).catch(() => {});
      if (inputPathOrUrl.startsWith(TEMP_DIR) && inputPathOrUrl !== sampleMp4Path) {
        await fs.rm(inputPathOrUrl, { force: true }).catch(() => {});
      }
      return res.status(500).json({
        error: 'Media conversion failed or timed out. Try downloading the Original Quality stream instead.'
      });
    }
  });

  // Safe Backend Streaming Proxy Endpoint
  app.get('/api/stream', rateLimiter, async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const requestedFilename = typeof req.query.filename === 'string' ? req.query.filename.trim() : '';

    if (rawUrl.startsWith('/api/sample-media/')) {
      return res.redirect(`${rawUrl}?download=1`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    req.on('close', () => {
      controller.abort();
    });

    try {
      const { response: upstreamRes, finalUrl } = await safeFetchWithRedirects(rawUrl, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!upstreamRes.ok || !upstreamRes.body) {
        return res.status(400).json({
          error: `Upstream media server responded with HTTP ${upstreamRes.status}.`
        });
      }

      const contentType = (upstreamRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const extInfo = getDirectExtensionInfo(finalUrl);
      const isAllowedMedia =
        contentType.startsWith('video/') ||
        contentType.startsWith('audio/') ||
        contentType === 'application/ogg' ||
        (contentType === 'application/octet-stream' && Boolean(extInfo));

      if (!isAllowedMedia) {
        await upstreamRes.body.cancel().catch(() => {});
        return res.status(400).json({
          error: `Blocked non-media content-type "${contentType}". Only direct video and audio streams are permitted.`
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

      const fallbackName = new URL(finalUrl).pathname.split('/').pop() || 'download';
      const safeFilename = (requestedFilename || fallbackName).replace(/[^a-zA-Z0-9._-]/g, '_');

      res.setHeader('Content-Type', extInfo?.mimeType || contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (contentLength && !Number.isNaN(contentLength)) {
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
          res.status(502).end('Stream interrupted.');
        } else {
          res.end();
        }
      });

      nodeStream.pipe(res);
    } catch (err: any) {
      clearTimeout(timeout);
      if (!res.headersSent) {
        res.status(400).json({
          error: err.message || 'Streaming failed.'
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
