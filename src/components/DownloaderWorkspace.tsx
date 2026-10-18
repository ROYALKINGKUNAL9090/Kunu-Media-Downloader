import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardPaste,
  X,
  Search,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  Trash2,
  Film,
  Music,
  ExternalLink
} from 'lucide-react';
import {
  validateMediaUrl,
  detectPlatform,
  formatBytes,
  AvailableStreamOption,
  PlatformInfo,
  mapHeightToQualityLabel
} from '../utils/mediaValidator';

export interface DownloadHistoryItem {
  id: string;
  title: string;
  sourceUrl: string;
  qualityLabel: string;
  container: string;
  sizeBytes: number | null;
  downloadedAt: string;
  platformName: string;
}

interface AnalysisResponse {
  url: string;
  finalUrl: string;
  platform: PlatformInfo;
  canDirectDownload: boolean;
  title: string;
  authorName?: string;
  thumbnailUrl?: string;
  mimeType: string;
  sizeBytes: number | null;
  videoWidth?: number;
  videoHeight?: number;
  durationSec?: number;
  acceptRanges: boolean;
  corsDirectSupported: boolean;
  streamOptions: AvailableStreamOption[];
  notice?: string;
  limitationExplanation?: string;
  supportedAlternative?: string;
}

interface DownloaderWorkspaceProps {
  initialUrl?: string;
  compactHero?: boolean;
}

const HISTORY_STORAGE_KEY = 'kunu_download_history_v2';

export const DownloaderWorkspace: React.FC<DownloaderWorkspaceProps> = ({
  initialUrl = '',
  compactHero = false
}) => {
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');

  const [useProxyPreview, setUseProxyPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'security' | 'info';
    text: string;
  } | null>(null);

  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load history from localStorage on mount (filtering out any legacy sample entries)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(
            (item: DownloadHistoryItem) =>
              item &&
              typeof item.sourceUrl === 'string' &&
              !item.sourceUrl.startsWith('/api/sample-media/')
          );
          setHistory(clean);
        }
      }
    } catch {
      // ignore storage read errors
    }
  }, []);

  // Update input when initialUrl prop changes
  useEffect(() => {
    if (initialUrl && initialUrl !== urlInput) {
      setUrlInput(initialUrl);
      handleAnalyze(initialUrl);
    }
  }, [initialUrl]);

  const saveHistory = (newItems: DownloadHistoryItem[]) => {
    setHistory(newItems);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newItems));
    } catch {
      // ignore storage write errors
    }
  };

  const handlePasteUrl = async () => {
    setStatusMessage(null);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setUrlInput(text.trim());
          setStatusMessage({
            type: 'info',
            text: 'URL pasted from clipboard. Click "Analyze Media" to inspect the source.'
          });
          return;
        }
      }
      setStatusMessage({
        type: 'info',
        text: 'Clipboard is empty or permission was denied. Press Ctrl+V / Cmd+V inside the input box.'
      });
    } catch {
      setStatusMessage({
        type: 'info',
        text: 'Browser blocked automatic clipboard read. Press Ctrl+V (or long-press Paste on mobile) in the URL input field.'
      });
    }
  };

  const handleClear = () => {
    setUrlInput('');
    setAnalysisResult(null);
    setSelectedOptionId('');
    setStatusMessage(null);
    setPreviewError(null);
    setUseProxyPreview(false);
    setIsDownloading(false);
    setDownloadProgress(null);
    setDownloadedBytes(0);
    setTotalBytes(null);
    inputRef.current?.focus();
  };

  const handleAnalyze = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl !== undefined ? overrideUrl : urlInput).trim();
    setStatusMessage(null);
    setAnalysisResult(null);
    setDownloadProgress(null);
    setPreviewError(null);
    setUseProxyPreview(false);

    const validation = validateMediaUrl(targetUrl);
    if (!validation.valid) {
      setStatusMessage({
        type:
          validation.errorCode === 'SSRF_BLOCKED' || validation.errorCode === 'CREDENTIALS_IN_URL'
            ? 'security'
            : 'error',
        text: validation.error || 'Invalid URL.'
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validation.sanitizedUrl })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        setStatusMessage({
          type: data?.errorCode === 'SSRF_BLOCKED' ? 'security' : 'error',
          text: data?.error || `Failed to analyze URL (HTTP ${response.status}).`
        });
        return;
      }

      const result = data as AnalysisResponse;
      setAnalysisResult(result);
      // Use proxy stream for preview if upstream server does not advertise permissive CORS
      setUseProxyPreview(!result.corsDirectSupported);

      if (result.canDirectDownload && result.streamOptions.length > 0) {
        const hasVideo = result.streamOptions.some((o) => !o.isAudioOnly);
        setActiveTab(hasVideo ? 'video' : 'audio');
        const firstMatching =
          result.streamOptions.find((o) => (hasVideo ? !o.isAudioOnly : o.isAudioOnly)) ||
          result.streamOptions[0];
        setSelectedOptionId(firstMatching.id);
        setStatusMessage({
          type: 'success',
          text: `Source verified: ${result.title} (${result.mimeType}). Ready for preview and download.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Direct media stream could not be extracted from ${result.platform.name}. See details below.`
        });
      }
    } catch {
      const detected = detectPlatform(targetUrl);
      setStatusMessage({
        type: 'error',
        text: `Network error while contacting backend analysis service for ${detected.name}. Please verify your connection and try again.`
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // When the HTML5 <video> preview loads metadata in the browser, read its actual intrinsic videoWidth x videoHeight
  const handleVideoLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid || !analysisResult) return;
    const w = vid.videoWidth;
    const h = vid.videoHeight;
    if (w > 0 && h > 0 && (!analysisResult.videoHeight || analysisResult.videoHeight !== h)) {
      const detectedLabel = mapHeightToQualityLabel(h);
      const updatedOptions = analysisResult.streamOptions.map((opt) => {
        if (opt.id === 'source-original') {
          return { ...opt, resolution: `${w}×${h}` };
        }
        return opt;
      });

      const hasExactLabel = updatedOptions.some((o) => o.label === detectedLabel && !o.isAudioOnly);
      if (!hasExactLabel) {
        updatedOptions.unshift({
          id: `intrinsic-${h}p`,
          label: detectedLabel,
          container: updatedOptions[0]?.container || 'MP4',
          mimeType: analysisResult.mimeType,
          isAudioOnly: false,
          resolution: `${w}×${h}`,
          sizeBytes: analysisResult.sizeBytes,
          directUrl: analysisResult.finalUrl,
          verifiedSource: true
        });
      }

      setAnalysisResult({
        ...analysisResult,
        videoWidth: w,
        videoHeight: h,
        durationSec:
          vid.duration && Number.isFinite(vid.duration)
            ? Math.round(vid.duration)
            : analysisResult.durationSec,
        streamOptions: updatedOptions
      });
    }
  };

  const handleMediaPreviewError = () => {
    if (!analysisResult) return;
    if (!useProxyPreview) {
      // Automatically switch from direct URL to backend proxy stream if direct playback hit CORS restrictions
      setUseProxyPreview(true);
    } else {
      setPreviewError(
        'Browser preview could not decode this stream directly, or the remote host blocked inline playback. You can still attempt to download the original file.'
      );
    }
  };

  const handleDownload = async () => {
    if (!analysisResult || !analysisResult.canDirectDownload) return;

    const chosenOption =
      analysisResult.streamOptions.find((o) => o.id === selectedOptionId) ||
      analysisResult.streamOptions[0];

    if (!chosenOption) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(chosenOption.sizeBytes ?? analysisResult.sizeBytes ?? null);
    setStatusMessage(null);

    const ext = chosenOption.container.toLowerCase();
    const baseCleanTitle =
      analysisResult.title
        .replace(/\.[a-zA-Z0-9]{2,4}$/, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 60) || 'media-file';
    const hasExtAlready = baseCleanTitle.toLowerCase().endsWith(`.${ext}`);
    const downloadFilename = hasExtAlready ? baseCleanTitle : `${baseCleanTitle}.${ext}`;

    const fetchEndpoint = `/api/stream?url=${encodeURIComponent(chosenOption.directUrl)}&filename=${encodeURIComponent(downloadFilename)}`;

    try {
      const response = await fetch(fetchEndpoint);
      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => null);
        throw new Error(
          errData?.error ||
            `Download failed: Upstream server responded with HTTP ${response.status}.`
        );
      }

      const responseContentType = (response.headers.get('content-type') || '').toLowerCase();
      if (
        responseContentType.includes('application/json') ||
        responseContentType.includes('text/html')
      ) {
        const errData = await response.json().catch(() => null);
        throw new Error(
          errData?.error ||
            'The remote URL returned a webpage or error response instead of a media stream.'
        );
      }

      const contentLengthHeader = response.headers.get('content-length');
      const total = contentLengthHeader
        ? Number(contentLengthHeader)
        : chosenOption.sizeBytes || null;
      setTotalBytes(total);

      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          setDownloadedBytes(received);
          if (total && total > 0) {
            setDownloadProgress(Math.min(100, Math.round((received / total) * 100)));
          }
        }
      }

      if (received === 0) {
        throw new Error(
          'Download failed: The remote server returned 0 bytes. The link may be expired or restricted.'
        );
      }

      const blob = new Blob(chunks, {
        type: chosenOption.mimeType || responseContentType || 'application/octet-stream'
      });
      const blobUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = downloadFilename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setDownloadProgress(100);
      setStatusMessage({
        type: 'success',
        text: `Download complete: "${downloadFilename}" (${formatBytes(received)}) saved from ${new URL(analysisResult.finalUrl).hostname}.`
      });

      const newHistoryItem: DownloadHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: analysisResult.title,
        sourceUrl: analysisResult.url,
        qualityLabel: chosenOption.label,
        container: chosenOption.container,
        sizeBytes: received,
        downloadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        platformName: analysisResult.platform.name
      };

      saveHistory([newHistoryItem, ...history.slice(0, 24)]);
    } catch (err: any) {
      setDownloadProgress(null);
      setStatusMessage({
        type: 'error',
        text:
          err.message ||
          'Download could not be completed. Verify the URL is a valid, publicly accessible media stream.'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyHistoryLink = async (item: DownloadHistoryItem) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(item.sourceUrl);
      }
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleClearHistory = () => {
    saveHistory([]);
  };

  const videoOptions = analysisResult?.streamOptions.filter((o) => !o.isAudioOnly) || [];
  const audioOptions = analysisResult?.streamOptions.filter((o) => o.isAudioOnly) || [];
  const displayedOptions = activeTab === 'video' ? videoOptions : audioOptions;

  const previewMediaSrc = analysisResult
    ? useProxyPreview
      ? `/api/stream?url=${encodeURIComponent(analysisResult.finalUrl)}&inline=1`
      : analysisResult.finalUrl
    : '';

  return (
    <section aria-label="Media Downloader Workspace" className="w-full max-w-5xl mx-auto">
      {/* Main Glassmorphism Downloader Card */}
      <div className="bg-[#0e0a1f]/90 backdrop-blur-xl border border-purple-500/25 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white font-display tracking-tight">
              Direct Media Analyzer & Downloader
            </h2>
            <p className="text-sm text-slate-300 mt-0.5">
              Paste a direct media link (MP4, WebM, MP3, WAV, OGG, M4A) to inspect, preview, and download the actual source file.
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
            HTTP/HTTPS Only · SSRF Protected
          </div>
        </div>

        {/* Central URL Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <label htmlFor="kunu-media-url-input" className="sr-only">
                Media URL
              </label>
              <input
                ref={inputRef}
                id="kunu-media-url-input"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/path/to/video.mp4"
                className="w-full bg-[#070510] border border-slate-700/80 focus:border-purple-400 focus:outline-none rounded-xl px-4 py-3.5 text-sm md:text-base text-white placeholder-slate-500 font-mono transition-colors"
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePasteUrl}
                className="flex-1 sm:flex-initial justify-center px-3.5 py-3.5 text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Paste URL from clipboard"
              >
                <ClipboardPaste className="w-4 h-4 text-purple-400" />
                <span>Paste URL</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={!urlInput && !analysisResult && !statusMessage}
                className="flex-1 sm:flex-initial justify-center px-3.5 py-3.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Clear URL and results"
              >
                <X className="w-4 h-4" />
                <span>Clear</span>
              </button>

              <button
                type="submit"
                disabled={isAnalyzing}
                className="w-full sm:w-auto justify-center px-5 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-60 rounded-xl flex items-center gap-2 transition-all whitespace-nowrap shrink-0 shadow-md cursor-pointer"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Analyze Media</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Supported direct formats:</span>
            <span className="font-mono text-slate-300">MP4 · WebM · MP3 · WAV · OGG · M4A</span>
            <span aria-hidden="true">·</span>
            <span>Preserves original source file & audio track</span>
          </div>
        </form>

        {/* Loading Animation State */}
        {isAnalyzing && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 p-6 rounded-xl bg-[#070510]/90 border border-purple-500/20 flex items-center gap-4"
          >
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">
                Inspecting upstream media headers & verifying source stream...
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Checking DNS/SSRF rules, following redirects safely, and reading actual Content-Type and native stream dimensions.
              </p>
            </div>
          </div>
        )}

        {/* Status / Error / Security Alert Banner */}
        {statusMessage && !isAnalyzing && (
          <div
            role="alert"
            className={`mt-6 p-4 rounded-xl border flex items-start gap-3 text-sm ${
              statusMessage.type === 'security'
                ? 'bg-red-950/50 border-red-500/40 text-red-200'
                : statusMessage.type === 'error'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-blue-950/40 border-blue-500/30 text-blue-200'
            }`}
          >
            {statusMessage.type === 'security' && (
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            {statusMessage.type === 'error' && (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            {statusMessage.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            {statusMessage.type === 'info' && (
              <Search className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium leading-relaxed">{statusMessage.text}</p>
            </div>
          </div>
        )}

        {/* Analysis Results Panel */}
        {analysisResult && !isAnalyzing && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-6">
            {/* Source Header Metadata */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="text-purple-300 font-semibold">
                    {analysisResult.platform.name}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{analysisResult.platform.statusLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{analysisResult.mimeType}</span>
                  {analysisResult.sizeBytes !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatBytes(analysisResult.sizeBytes)}
                      </span>
                    </>
                  )}
                  {analysisResult.videoWidth && analysisResult.videoHeight && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {analysisResult.videoWidth}×{analysisResult.videoHeight}
                      </span>
                    </>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white break-all">{analysisResult.title}</h3>
                <p className="text-xs text-slate-400 font-mono break-all">
                  Source URL: {analysisResult.finalUrl}
                </p>
                {analysisResult.authorName && (
                  <p className="text-xs text-slate-400">
                    Creator / Channel: {analysisResult.authorName}
                  </p>
                )}
              </div>

              {analysisResult.notice && (
                <p className="text-xs text-slate-400 max-w-md">{analysisResult.notice}</p>
              )}
            </div>

            {/* Case A: Legitimate Direct Downloadable Media Stream */}
            {analysisResult.canDirectDownload ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Media Preview Box (5 cols) — plays the exact supplied source URL */}
                <div className="lg:col-span-5 bg-[#070510] border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                    <span>Actual Source Stream Preview</span>
                    <span className="font-mono">
                      {useProxyPreview ? 'Stream Proxy' : 'Direct CORS'}
                    </span>
                  </div>

                  {analysisResult.mimeType.startsWith('video/') ? (
                    <video
                      key={previewMediaSrc}
                      ref={videoRef}
                      src={previewMediaSrc}
                      controls
                      preload="metadata"
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onError={handleMediaPreviewError}
                      className="w-full rounded-lg bg-black aspect-video object-contain border border-slate-800"
                    />
                  ) : (
                    <div className="py-6 px-4 bg-[#0d0920] rounded-lg border border-purple-500/20 flex flex-col items-center justify-center gap-3">
                      <Music className="w-8 h-8 text-purple-400" />
                      <audio
                        key={previewMediaSrc}
                        src={previewMediaSrc}
                        controls
                        preload="metadata"
                        onError={handleMediaPreviewError}
                        className="w-full"
                      />
                    </div>
                  )}

                  {previewError ? (
                    <p className="text-xs text-amber-300 leading-relaxed">{previewError}</p>
                  ) : (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Playing directly from the supplied media URL with its original synchronized audio stream.
                    </p>
                  )}
                </div>

                {/* Verified Quality & Format Selection + Download Action (7 cols) */}
                <div className="lg:col-span-7 bg-[#070510] border border-slate-800 rounded-xl p-5 space-y-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                      {videoOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('video');
                            setSelectedOptionId(videoOptions[0].id);
                          }}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            activeTab === 'video'
                              ? 'bg-purple-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>Video Stream ({videoOptions.length})</span>
                        </button>
                      )}
                      {audioOptions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('audio');
                            setSelectedOptionId(audioOptions[0].id);
                          }}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            activeTab === 'audio'
                              ? 'bg-purple-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Music className="w-3.5 h-3.5" />
                          <span>Audio Stream ({audioOptions.length})</span>
                        </button>
                      )}
                    </div>

                    <span className="text-xs text-slate-400 font-mono">
                      Genuine Source Quality Only
                    </span>
                  </div>

                  {/* Quality / Format Option Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {displayedOptions.map((opt) => {
                      const isSelected = opt.id === selectedOptionId;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedOptionId(opt.id)}
                          className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600/20 border-purple-400 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold">{opt.label}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {opt.container}
                              {opt.resolution ? ` · ${opt.resolution}` : ''}
                            </div>
                          </div>
                          <div className="text-xs font-mono tabular-nums text-slate-300 shrink-0">
                            {opt.sizeBytes ? formatBytes(opt.sizeBytes) : 'Direct Stream'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Real-Time Progress Indicator */}
                  {(isDownloading || downloadProgress !== null) && (
                    <div className="space-y-2 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="text-purple-300">
                          {isDownloading ? 'Streaming source media bytes...' : 'Transfer complete'}
                        </span>
                        <span className="text-white">
                          {formatBytes(downloadedBytes)}
                          {totalBytes ? ` / ${formatBytes(totalBytes)}` : ''}
                          {downloadProgress !== null ? ` (${downloadProgress}%)` : ''}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-150"
                          style={{ width: `${downloadProgress ?? 25}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Primary Download Action Button */}
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading || !selectedOptionId}
                    className="w-full py-3.5 px-6 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Downloading Source Media...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>
                          Download{' '}
                          {displayedOptions.find((o) => o.id === selectedOptionId)?.label ||
                            'Original File'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Case B: Unsupported / Restricted Platform URL — Accurate Explanation, Zero Fake Video */
              <div className="bg-[#070510] border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-5 items-start">
                  {analysisResult.thumbnailUrl && (
                    <img
                      src={analysisResult.thumbnailUrl}
                      alt={analysisResult.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                      className="w-full md:w-56 aspect-video object-cover rounded-lg border border-slate-800 shrink-0"
                    />
                  )}
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Source Cannot Be Extracted Directly from {analysisResult.platform.name}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      <strong className="text-white">Why this source cannot be downloaded here:</strong>{' '}
                      {analysisResult.limitationExplanation ||
                        analysisResult.platform.technicalLimitation}
                    </p>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      <strong className="text-purple-300">Supported legitimate alternative:</strong>{' '}
                      {analysisResult.supportedAlternative ||
                        analysisResult.platform.supportedAlternative}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleClear}
                        className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors cursor-pointer"
                      >
                        Enter a Direct Media URL (.mp4, .webm, .mp3, .m4a)
                      </button>
                      <a
                        href={analysisResult.finalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open Original Link on {analysisResult.platform.name}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Local Device Download History */}
      {!compactHero && (
        <div className="mt-8 bg-[#0e0a1f]/80 border border-slate-800/90 rounded-2xl p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white font-display">
                Local Download History
              </h3>
              <p className="text-xs text-slate-400">
                Stored privately in your browser’s local storage on this device. Never uploaded to any server.
              </p>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="px-3.5 py-2 text-xs font-medium text-red-300 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded-lg flex items-center gap-1.5 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-slate-800 rounded-xl">
              <p className="text-sm text-slate-400">
                No downloads recorded on this device yet. Analyze and download a direct media file above to populate your history.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{item.title}</div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 font-mono tabular-nums">
                      <span>{item.platformName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-purple-300">{item.qualityLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.container}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(item.sizeBytes)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.downloadedAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyHistoryLink(item)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUrlInput(item.sourceUrl);
                        handleAnalyze(item.sourceUrl);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-purple-300 hover:text-white bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Re-Analyze
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
