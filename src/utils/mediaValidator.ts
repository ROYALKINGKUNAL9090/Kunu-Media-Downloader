export type PlatformId =
  | 'direct'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'whatsapp'
  | 'twitter'
  | 'tiktok'
  | 'vimeo'
  | 'reddit'
  | 'telegram'
  | 'pinterest'
  | 'dailymotion'
  | 'twitch'
  | 'other';

export type SupportStatus = 'direct_supported' | 'public_metadata_only' | 'restricted_platform';

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  category: 'Direct File' | 'Video Platform' | 'Social Media' | 'Messaging';
  supportStatus: SupportStatus;
  statusLabel: string;
  description: string;
  technicalLimitation: string;
  supportedAlternative: string;
  domains: string[];
}

export interface ValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
  errorCode?: 'EMPTY_URL' | 'INVALID_URL' | 'UNSUPPORTED_PROTOCOL' | 'SSRF_BLOCKED' | 'CREDENTIALS_IN_URL';
}

export type QualityLabel =
  | '144p'
  | '240p'
  | '360p'
  | '480p'
  | '720p HD'
  | '1080p Full HD'
  | '1440p 2K'
  | '2160p 4K'
  | 'Original Quality'
  | 'Audio Only';

export type AudioFormatLabel = 'MP3' | 'M4A' | 'WAV' | 'OGG' | 'Original Audio';

export interface AvailableStreamOption {
  id: string;
  label: QualityLabel | AudioFormatLabel;
  container: 'MP4' | 'WebM' | 'MP3' | 'WAV' | 'OGG' | 'M4A' | 'Stream';
  mimeType: string;
  isAudioOnly: boolean;
  resolution?: string;
  sizeBytes?: number | null;
  directUrl: string;
  verifiedSource: boolean;
}

export const PLATFORMS: PlatformInfo[] = [
  {
    id: 'direct',
    name: 'Direct Media URLs',
    category: 'Direct File',
    supportStatus: 'direct_supported',
    statusLabel: 'Full Direct Download',
    description: 'Publicly accessible HTTP/HTTPS links pointing directly to MP4, WebM, MP3, WAV, OGG, or M4A files on CDNs, cloud buckets, or self-hosted servers.',
    technicalLimitation: 'Subject to upstream server availability, link expiration, and file size limits (max 150 MB via proxy stream; unlimited via direct browser download).',
    supportedAlternative: 'Supports both browser-native download and CORS-safe backend streaming proxy preserving original file quality.',
    domains: ['*.mp4', '*.webm', '*.mp3', '*.wav', '*.ogg', '*.m4a']
  },
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'Video Platform',
    supportStatus: 'public_metadata_only',
    statusLabel: 'Unsupported Direct Extraction',
    description: 'Detects standard YouTube videos, Shorts, and youtu.be links. Retrieves official public title, author, and thumbnail via YouTube oEmbed when available.',
    technicalLimitation: 'YouTube Terms of Service (Section 5.B) and stream cipher/DRM protections prohibit third-party video stream extraction without explicit creator authorization.',
    supportedAlternative: 'Download your own videos directly from YouTube Studio, or provide a direct link to an MP4/WebM file you own or have permission to access.',
    domains: ['youtube.com', 'youtu.be']
  },
  {
    id: 'instagram',
    name: 'Instagram & Reels',
    category: 'Social Media',
    supportStatus: 'restricted_platform',
    statusLabel: 'Auth / API Required',
    description: 'Identifies Instagram posts, Reels, and Stories URLs (`instagram.com/reel/...`, `instagram.com/p/...`).',
    technicalLimitation: 'Meta Graph API requires authenticated app tokens and user permissions; unauthenticated stream extraction is blocked by login walls and platform access controls.',
    supportedAlternative: 'Use Instagram’s built-in "Download" option on public Reels in the mobile app or request your account archive from Meta Accounts Center.',
    domains: ['instagram.com', 'instagr.am', 'cdninstagram.com']
  },
  {
    id: 'facebook',
    name: 'Facebook & Reels',
    category: 'Social Media',
    supportStatus: 'restricted_platform',
    statusLabel: 'Auth / API Required',
    description: 'Detects Facebook Watch videos, Facebook Reels, and `fb.watch` shortlinks.',
    technicalLimitation: 'Facebook video streams use segmented DASH manifests protected by session tokens and Meta Graph API access controls.',
    supportedAlternative: 'Download your own uploaded videos via Meta Business Suite or supply a direct `.mp4` CDN URL if publicly accessible and permitted.',
    domains: ['facebook.com', 'fb.watch', 'fb.com', 'fbcdn.net']
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Media Links',
    category: 'Messaging',
    supportStatus: 'restricted_platform',
    statusLabel: 'End-to-End Encrypted',
    description: 'Recognizes WhatsApp shared links (`wa.me`, `whatsapp.com`) and encrypted CDN attachments (`mmg.whatsapp.net`).',
    technicalLimitation: 'WhatsApp media payloads on `mmg.whatsapp.net` are encrypted with AES-256 keys exchanged solely between client devices via the Signal protocol.',
    supportedAlternative: 'Save media directly inside WhatsApp Web/Desktop first, or host shared files on a direct HTTPS media link.',
    domains: ['whatsapp.com', 'wa.me', 'mmg.whatsapp.net']
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    category: 'Social Media',
    supportStatus: 'public_metadata_only',
    statusLabel: 'Direct CDN / API Required',
    description: 'Detects X (`x.com`, `twitter.com`) status URLs and direct `video.twimg.com` media streams.',
    technicalLimitation: 'Standard X status URLs require authenticated X API v2 access. Direct `video.twimg.com/*.mp4` file links can be downloaded if publicly accessible and not expired.',
    supportedAlternative: 'Provide a direct `video.twimg.com` `.mp4` URL if you have permission, or use X Premium’s native offline video download feature.',
    domains: ['x.com', 'twitter.com', 't.co', 'video.twimg.com', 'pbs.twimg.com']
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'Social Media',
    supportStatus: 'public_metadata_only',
    statusLabel: 'oEmbed Metadata Only',
    description: 'Detects TikTok video URLs (`tiktok.com/@user/video/...`) and fetches public oEmbed metadata when available.',
    technicalLimitation: 'TikTok video streams require signed cookies and device attestation headers. Bypassing creator download switches violates platform controls.',
    supportedAlternative: 'When a creator enables downloads, tap Share -> Save Video directly in the TikTok app or web player.',
    domains: ['tiktok.com', 'vm.tiktok.com', 'tiktokcdn.com']
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    category: 'Video Platform',
    supportStatus: 'public_metadata_only',
    statusLabel: 'oEmbed & Creator Downloads',
    description: 'Detects Vimeo videos (`vimeo.com/...`) and retrieves real title, creator, and thumbnail metadata via Vimeo’s public oEmbed API.',
    technicalLimitation: 'Direct MP4 extraction from player manifests requires owner API tokens unless the creator explicitly enabled public file downloads on Vimeo.',
    supportedAlternative: 'Use the native "Download" button below Vimeo videos where the creator has enabled public downloading, or paste a Vimeo Pro direct file link.',
    domains: ['vimeo.com', 'player.vimeo.com']
  },
  {
    id: 'reddit',
    name: 'Reddit',
    category: 'Social Media',
    supportStatus: 'public_metadata_only',
    statusLabel: 'Direct v.redd.it / i.redd.it',
    description: 'Detects Reddit threads and direct `i.redd.it` / `v.redd.it` fallback MP4 media links.',
    technicalLimitation: 'Reddit thread pages require OAuth API access and separate video (`DASH_720.mp4`) and audio (`DASH_audio.mp4`) tracks on `v.redd.it`.',
    supportedAlternative: 'Paste a direct `v.redd.it/.../DASH_720.mp4` link to download the video stream, or use Reddit’s native mobile Save Video action.',
    domains: ['reddit.com', 'redd.it', 'v.redd.it', 'i.redd.it']
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'Messaging',
    supportStatus: 'restricted_platform',
    statusLabel: 'Bot API / Client Required',
    description: 'Identifies Telegram public channel post links (`t.me/channel/123`) and Telegram CDN links.',
    technicalLimitation: 'Telegram media files require MTProto client sessions or a Telegram Bot API token unless exposed via a direct public CDN file URL.',
    supportedAlternative: 'Use Telegram Desktop/Mobile’s built-in "Save File As..." button, which supports unrestricted downloads up to 4 GB.',
    domains: ['t.me', 'telegram.me', 'telegram.org', 'cdn-telegram.org']
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    category: 'Social Media',
    supportStatus: 'public_metadata_only',
    statusLabel: 'Direct pinimg.com Supported',
    description: 'Detects Pinterest Pin URLs (`pinterest.com/pin/...`) and direct `v.pinimg.com` MP4 video assets.',
    technicalLimitation: 'Pin wrapper pages require Pinterest API v5 authentication, while direct `v.pinimg.com/*.mp4` files can be downloaded directly.',
    supportedAlternative: 'Provide a direct `v.pinimg.com/.../*.mp4` media URL or use Pinterest’s native asset download option.',
    domains: ['pinterest.com', 'pin.it', 'pinimg.com', 'v.pinimg.com']
  },
  {
    id: 'dailymotion',
    name: 'Dailymotion',
    category: 'Video Platform',
    supportStatus: 'public_metadata_only',
    statusLabel: 'oEmbed Metadata Only',
    description: 'Detects Dailymotion links (`dailymotion.com/video/...`, `dai.ly/...`) and retrieves public oEmbed metadata.',
    technicalLimitation: 'Dailymotion streams use HLS `.m3u8` segmented manifests with token expiration rather than progressive single-file MP4s.',
    supportedAlternative: 'Partners can download original MP4 masters directly from Dailymotion Studio.',
    domains: ['dailymotion.com', 'dai.ly']
  },
  {
    id: 'twitch',
    name: 'Twitch',
    category: 'Video Platform',
    supportStatus: 'restricted_platform',
    statusLabel: 'Creator VOD / Clips Only',
    description: 'Detects Twitch VODs, live streams, and `clips.twitch.tv` URLs.',
    technicalLimitation: 'Twitch streams use authenticated HLS manifests requiring Helix API tokens and GQL integrity headers.',
    supportedAlternative: 'Streamers and editors can download VODs and Clips as direct MP4 files from the Twitch Creator Dashboard -> Video Producer.',
    domains: ['twitch.tv', 'clips.twitch.tv']
  }
];

const SUPPORTED_DIRECT_EXTENSIONS: Record<string, { container: AvailableStreamOption['container']; mimeType: string; isAudioOnly: boolean; audioFormat?: AudioFormatLabel }> = {
  '.mp4': { container: 'MP4', mimeType: 'video/mp4', isAudioOnly: false },
  '.webm': { container: 'WebM', mimeType: 'video/webm', isAudioOnly: false },
  '.mp3': { container: 'MP3', mimeType: 'audio/mpeg', isAudioOnly: true, audioFormat: 'MP3' },
  '.wav': { container: 'WAV', mimeType: 'audio/wav', isAudioOnly: true, audioFormat: 'WAV' },
  '.ogg': { container: 'OGG', mimeType: 'audio/ogg', isAudioOnly: true, audioFormat: 'OGG' },
  '.m4a': { container: 'M4A', mimeType: 'audio/mp4', isAudioOnly: true, audioFormat: 'M4A' }
};

/**
 * Checks if an IPv4 or IPv6 address or hostname is private, loopback, link-local, or cloud metadata (SSRF protection).
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  const cleanHost = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');

  if (!cleanHost) return true;

  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.arpa') ||
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'metadata' ||
    cleanHost === '0.0.0.0'
  ) {
    return true;
  }

  if (cleanHost.includes(':')) {
    if (
      cleanHost === '::1' ||
      cleanHost === '::' ||
      cleanHost.startsWith('fe80:') ||
      cleanHost.startsWith('fc') ||
      cleanHost.startsWith('fd') ||
      cleanHost.startsWith('ff')
    ) {
      return true;
    }
    const ipv4MappedMatch = cleanHost.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (ipv4MappedMatch) {
      return isPrivateOrReservedHost(ipv4MappedMatch[1]);
    }
    return false;
  }

  if (/^\d+$/.test(cleanHost) || /^0x[0-9a-f]+$/i.test(cleanHost)) {
    return true;
  }

  const ipv4Parts = cleanHost.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => /^\d+$/.test(part))) {
    const octets = ipv4Parts.map((p) => Number(p));
    if (octets.some((o) => o < 0 || o > 255)) {
      return true;
    }
    const [a, b] = octets;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
  }

  return false;
}

/**
 * Validates a user-supplied URL for HTTP/HTTPS protocol, syntax, and SSRF protection.
 */
export function validateMediaUrl(rawInput: string): ValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Please enter or paste a media URL to analyze.',
      errorCode: 'EMPTY_URL'
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: 'Invalid URL format. Please include http:// or https:// at the beginning of the link.',
      errorCode: 'INVALID_URL'
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `Unsupported protocol "${parsed.protocol.replace(':', '')}". Only HTTP and HTTPS media URLs are permitted.`,
      errorCode: 'UNSUPPORTED_PROTOCOL'
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'URLs containing embedded credentials (username:password) are blocked for security.',
      errorCode: 'CREDENTIALS_IN_URL'
    };
  }

  if (isPrivateOrReservedHost(parsed.hostname)) {
    return {
      valid: false,
      error: `Security block (SSRF Protection): Requests to private IP addresses, localhost, or internal cloud metadata endpoints (${parsed.hostname}) are strictly prohibited.`,
      errorCode: 'SSRF_BLOCKED'
    };
  }

  return {
    valid: true,
    sanitizedUrl: parsed.toString()
  };
}

/**
 * Detects if a URL path ends with a direct media file extension (.mp4, .webm, .mp3, .wav, .ogg, .m4a).
 */
export function getDirectExtensionInfo(urlStr: string): {
  ext: string;
  container: AvailableStreamOption['container'];
  mimeType: string;
  isAudioOnly: boolean;
  audioFormat?: AudioFormatLabel;
} | null {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase();
    for (const [ext, info] of Object.entries(SUPPORTED_DIRECT_EXTENSIONS)) {
      if (pathname.endsWith(ext)) {
        return { ext, ...info };
      }
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}

/**
 * Detects which platform a URL belongs to.
 */
export function detectPlatform(urlStr: string): PlatformInfo {
  const trimmed = urlStr.trim();

  let hostname = '';
  try {
    const u = new URL(trimmed);
    hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return PLATFORMS.find((p) => p.id === 'direct')!;
  }

  const extInfo = getDirectExtensionInfo(trimmed);

  if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be') {
    return PLATFORMS.find((p) => p.id === 'youtube')!;
  }
  if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com') || hostname === 'instagr.am' || hostname.endsWith('.cdninstagram.com')) {
    return PLATFORMS.find((p) => p.id === 'instagram')!;
  }
  if (hostname === 'facebook.com' || hostname.endsWith('.facebook.com') || hostname === 'fb.watch' || hostname === 'fb.com' || hostname.endsWith('.fbcdn.net')) {
    return PLATFORMS.find((p) => p.id === 'facebook')!;
  }
  if (hostname === 'whatsapp.com' || hostname.endsWith('.whatsapp.com') || hostname === 'wa.me' || hostname.endsWith('.whatsapp.net')) {
    return PLATFORMS.find((p) => p.id === 'whatsapp')!;
  }
  if (hostname === 'x.com' || hostname.endsWith('.x.com') || hostname === 'twitter.com' || hostname.endsWith('.twitter.com') || hostname === 't.co' || hostname.endsWith('.twimg.com')) {
    return PLATFORMS.find((p) => p.id === 'twitter')!;
  }
  if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com') || hostname.endsWith('.tiktokcdn.com')) {
    return PLATFORMS.find((p) => p.id === 'tiktok')!;
  }
  if (hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) {
    return PLATFORMS.find((p) => p.id === 'vimeo')!;
  }
  if (hostname === 'reddit.com' || hostname.endsWith('.reddit.com') || hostname === 'redd.it' || hostname === 'v.redd.it' || hostname === 'i.redd.it') {
    return PLATFORMS.find((p) => p.id === 'reddit')!;
  }
  if (hostname === 't.me' || hostname === 'telegram.me' || hostname === 'telegram.org' || hostname.endsWith('.telegram.org') || hostname.endsWith('.cdn-telegram.org')) {
    return PLATFORMS.find((p) => p.id === 'telegram')!;
  }
  if (hostname === 'pinterest.com' || hostname.endsWith('.pinterest.com') || hostname === 'pin.it' || hostname.endsWith('.pinimg.com')) {
    return PLATFORMS.find((p) => p.id === 'pinterest')!;
  }
  if (hostname === 'dailymotion.com' || hostname.endsWith('.dailymotion.com') || hostname === 'dai.ly') {
    return PLATFORMS.find((p) => p.id === 'dailymotion')!;
  }
  if (hostname === 'twitch.tv' || hostname.endsWith('.twitch.tv')) {
    return PLATFORMS.find((p) => p.id === 'twitch')!;
  }

  if (extInfo) {
    return PLATFORMS.find((p) => p.id === 'direct')!;
  }

  return {
    id: 'other',
    name: 'Public Web Media Source',
    category: 'Direct File',
    supportStatus: 'direct_supported',
    statusLabel: 'HTTP Stream Inspection',
    description: `Inspects ${hostname} for direct downloadable video or audio MIME headers.`,
    technicalLimitation: 'Only direct media streams (video/* or audio/*) can be downloaded. HTML webpages without direct media streams cannot be converted into video files.',
    supportedAlternative: 'Provide a direct media file URL (.mp4, .webm, .mp3, .wav, .ogg, .m4a) that is publicly accessible.',
    domains: [hostname]
  };
}

/**
 * Maps an actual measured video height (from ffprobe or browser HTMLVideoElement) to a QualityLabel.
 * Never fabricates multiple resolutions that do not exist at the source.
 */
export function mapHeightToQualityLabel(height?: number | null): QualityLabel {
  if (!height || height <= 0) return 'Original Quality';
  if (height <= 160) return '144p';
  if (height <= 270) return '240p';
  if (height <= 400) return '360p';
  if (height <= 540) return '480p';
  if (height <= 800) return '720p HD';
  if (height <= 1200) return '1080p Full HD';
  if (height <= 1600) return '1440p 2K';
  return '2160p 4K';
}

/**
 * Builds the honest list of available stream options strictly from the actual inspected source file.
 * Never fabricates 720p, 1080p, or 4K options that do not exist on the source.
 */
export function buildVerifiedStreamOptions(params: {
  directUrl: string;
  mimeType: string;
  sizeBytes?: number | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
}): AvailableStreamOption[] {
  const options: AvailableStreamOption[] = [];
  const cleanMime = params.mimeType.split(';')[0].trim().toLowerCase();
  const extInfo = getDirectExtensionInfo(params.directUrl);

  const isAudio =
    cleanMime.startsWith('audio/') ||
    (extInfo ? extInfo.isAudioOnly : false);

  let container: AvailableStreamOption['container'] = 'Stream';
  if (cleanMime === 'video/mp4' || extInfo?.container === 'MP4') container = 'MP4';
  else if (cleanMime === 'video/webm' || extInfo?.container === 'WebM') container = 'WebM';
  else if (cleanMime === 'audio/mpeg' || cleanMime === 'audio/mp3' || extInfo?.container === 'MP3') container = 'MP3';
  else if (cleanMime === 'audio/wav' || cleanMime === 'audio/x-wav' || extInfo?.container === 'WAV') container = 'WAV';
  else if (cleanMime === 'audio/ogg' || cleanMime === 'application/ogg' || extInfo?.container === 'OGG') container = 'OGG';
  else if (cleanMime === 'audio/mp4' || cleanMime === 'audio/x-m4a' || extInfo?.container === 'M4A') container = 'M4A';

  if (isAudio) {
    const audioFormatLabel: AudioFormatLabel =
      container === 'MP3'
        ? 'MP3'
        : container === 'M4A'
        ? 'M4A'
        : container === 'WAV'
        ? 'WAV'
        : container === 'OGG'
        ? 'OGG'
        : 'Original Audio';

    options.push({
      id: 'source-audio-format',
      label: audioFormatLabel,
      container,
      mimeType: cleanMime || 'audio/mpeg',
      isAudioOnly: true,
      sizeBytes: params.sizeBytes ?? null,
      directUrl: params.directUrl,
      verifiedSource: true
    });

    if (audioFormatLabel !== 'Original Audio') {
      options.push({
        id: 'source-audio-only',
        label: 'Audio Only',
        container,
        mimeType: cleanMime || 'audio/mpeg',
        isAudioOnly: true,
        sizeBytes: params.sizeBytes ?? null,
        directUrl: params.directUrl,
        verifiedSource: true
      });
    }
  } else {
    // Video source: only display the genuine measured resolution (if known) and Original Quality pointing to the exact source URL
    if (params.videoHeight && params.videoHeight > 0) {
      const detectedQuality = mapHeightToQualityLabel(params.videoHeight);
      const resolutionStr = params.videoWidth
        ? `${params.videoWidth}×${params.videoHeight}`
        : `${params.videoHeight}p`;

      options.push({
        id: `verified-${detectedQuality.replace(/\s+/g, '-').toLowerCase()}`,
        label: detectedQuality,
        container: container === 'Stream' ? 'MP4' : container,
        mimeType: cleanMime || 'video/mp4',
        isAudioOnly: false,
        resolution: resolutionStr,
        sizeBytes: params.sizeBytes ?? null,
        directUrl: params.directUrl,
        verifiedSource: true
      });
    }

    options.push({
      id: 'source-original',
      label: 'Original Quality',
      container: container === 'Stream' ? 'MP4' : container,
      mimeType: cleanMime || 'video/mp4',
      isAudioOnly: false,
      resolution:
        params.videoWidth && params.videoHeight
          ? `${params.videoWidth}×${params.videoHeight}`
          : 'Original Source Stream',
      sizeBytes: params.sizeBytes ?? null,
      directUrl: params.directUrl,
      verifiedSource: true
    });
  }

  return options;
}

/**
 * Formats byte counts into human-readable tabular strings (e.g. "4.28 MB").
 */
export function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes) || bytes < 0) {
    return 'Unknown size';
  }
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
}
