import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateOrReservedHost,
  validateMediaUrl,
  detectPlatform,
  mapHeightToQualityLabel,
  buildVerifiedStreamOptions,
  formatBytes
} from './mediaValidator.ts';

test('SSRF protection blocks localhost, private IPs, and cloud metadata endpoints', () => {
  assert.equal(isPrivateOrReservedHost('localhost'), true);
  assert.equal(isPrivateOrReservedHost('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedHost('127.0.1.1'), true);
  assert.equal(isPrivateOrReservedHost('0.0.0.0'), true);
  assert.equal(isPrivateOrReservedHost('10.0.0.1'), true);
  assert.equal(isPrivateOrReservedHost('172.16.0.5'), true);
  assert.equal(isPrivateOrReservedHost('172.31.255.255'), true);
  assert.equal(isPrivateOrReservedHost('192.168.1.100'), true);
  assert.equal(isPrivateOrReservedHost('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedHost('metadata.google.internal'), true);
  assert.equal(isPrivateOrReservedHost('[::1]'), true);
  assert.equal(isPrivateOrReservedHost('2130706433'), true); // decimal IP obfuscation

  // Public domains and IPs should pass
  assert.equal(isPrivateOrReservedHost('172.32.0.1'), false);
  assert.equal(isPrivateOrReservedHost('8.8.8.8'), false);
  assert.equal(isPrivateOrReservedHost('cdn.example.com'), false);
});

test('validateMediaUrl enforces HTTP/HTTPS and blocks SSRF and invalid inputs', () => {
  assert.equal(validateMediaUrl('').valid, false);
  assert.equal(validateMediaUrl('').errorCode, 'EMPTY_URL');

  assert.equal(validateMediaUrl('not-a-url').valid, false);
  assert.equal(validateMediaUrl('not-a-url').errorCode, 'INVALID_URL');

  assert.equal(validateMediaUrl('ftp://files.example.com/video.mp4').valid, false);
  assert.equal(validateMediaUrl('ftp://files.example.com/video.mp4').errorCode, 'UNSUPPORTED_PROTOCOL');

  assert.equal(validateMediaUrl('http://169.254.169.254/latest/meta-data/').valid, false);
  assert.equal(validateMediaUrl('http://169.254.169.254/latest/meta-data/').errorCode, 'SSRF_BLOCKED');

  assert.equal(validateMediaUrl('http://localhost:8080/internal.mp4').valid, false);
  assert.equal(validateMediaUrl('http://localhost:8080/internal.mp4').errorCode, 'SSRF_BLOCKED');

  assert.equal(validateMediaUrl('https://user:pass@example.com/video.mp4').valid, false);
  assert.equal(validateMediaUrl('https://user:pass@example.com/video.mp4').errorCode, 'CREDENTIALS_IN_URL');

  const validRes = validateMediaUrl('https://cdn.example.com/media/clip.mp4');
  assert.equal(validRes.valid, true);
  assert.equal(validRes.sanitizedUrl, 'https://cdn.example.com/media/clip.mp4');
});

test('detectPlatform accurately classifies all 13 supported platforms and direct links', () => {
  assert.equal(detectPlatform('https://www.youtube.com/watch?v=abc').id, 'youtube');
  assert.equal(detectPlatform('https://youtu.be/abc').id, 'youtube');
  assert.equal(detectPlatform('https://www.instagram.com/reel/xyz/').id, 'instagram');
  assert.equal(detectPlatform('https://www.facebook.com/reel/123').id, 'facebook');
  assert.equal(detectPlatform('https://wa.me/12345').id, 'whatsapp');
  assert.equal(detectPlatform('https://x.com/user/status/123').id, 'twitter');
  assert.equal(detectPlatform('https://www.tiktok.com/@user/video/123').id, 'tiktok');
  assert.equal(detectPlatform('https://vimeo.com/76979871').id, 'vimeo');
  assert.equal(detectPlatform('https://www.reddit.com/r/videos/comments/123').id, 'reddit');
  assert.equal(detectPlatform('https://t.me/telegram/123').id, 'telegram');
  assert.equal(detectPlatform('https://www.pinterest.com/pin/123/').id, 'pinterest');
  assert.equal(detectPlatform('https://www.dailymotion.com/video/x8abc').id, 'dailymotion');
  assert.equal(detectPlatform('https://www.twitch.tv/videos/123').id, 'twitch');
  assert.equal(detectPlatform('https://cdn.example.org/files/podcast.mp3').id, 'direct');
});

test('mapHeightToQualityLabel and buildVerifiedStreamOptions never invent unverified resolutions', () => {
  assert.equal(mapHeightToQualityLabel(144), '144p');
  assert.equal(mapHeightToQualityLabel(240), '240p');
  assert.equal(mapHeightToQualityLabel(360), '360p');
  assert.equal(mapHeightToQualityLabel(480), '480p');
  assert.equal(mapHeightToQualityLabel(720), '720p HD');
  assert.equal(mapHeightToQualityLabel(1080), '1080p Full HD');
  assert.equal(mapHeightToQualityLabel(1440), '1440p 2K');
  assert.equal(mapHeightToQualityLabel(2160), '2160p 4K');

  // A 720p direct MP4 without extra variant streams should only list 720p HD and Original Quality
  const videoOpts = buildVerifiedStreamOptions({
    directUrl: 'https://cdn.example.com/sample.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 5242880,
    videoWidth: 1280,
    videoHeight: 720
  });
  assert.equal(videoOpts.length, 2);
  assert.equal(videoOpts[0].label, '720p HD');
  assert.equal(videoOpts[1].label, 'Original Quality');

  // An MP3 direct audio file should only list MP3 and Audio Only
  const audioOpts = buildVerifiedStreamOptions({
    directUrl: 'https://cdn.example.com/track.mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 2097152
  });
  assert.equal(audioOpts.length, 2);
  assert.equal(audioOpts[0].label, 'MP3');
  assert.equal(audioOpts[1].label, 'Audio Only');
  assert.equal(audioOpts[0].isAudioOnly, true);
});

test('formatBytes formats byte sizes cleanly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.00 KB');
  assert.equal(formatBytes(1048576), '1.00 MB');
  assert.equal(formatBytes(null), 'Unknown size');
});
