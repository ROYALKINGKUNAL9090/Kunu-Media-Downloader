import React, { useState } from 'react';
import { Copy, Check, Terminal, Server, Globe, ShieldCheck } from 'lucide-react';

interface HowToUseAndDeployProps {
  onOpenDownloader: () => void;
}

export const HowToUseAndDeploy: React.FC<HowToUseAndDeployProps> = ({ onOpenDownloader }) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleCopyCode = async (id: string, code: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch {
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  const steps = [
    {
      num: '01.',
      title: 'Copy a Direct Media Link or Platform URL',
      body: 'Copy any publicly accessible HTTP or HTTPS media link (.mp4, .webm, .mp3, .wav, .ogg, .m4a) that you own or have permission to download, or paste a social video URL to inspect its platform rules.'
    },
    {
      num: '02.',
      title: 'Analyze Stream Headers & SSRF Safety',
      body: 'Click "Analyze Media". The engine validates URL syntax, blocks private/internal IPs (SSRF protection), checks CORS headers, and reads native video resolution and audio stream availability.'
    },
    {
      num: '03.',
      title: 'Preview & Select Genuine Source Quality',
      body: 'Preview the actual media file and its synchronized audio track directly in the player, then select the genuine source quality or audio stream.'
    },
    {
      num: '04.',
      title: 'Stream & Save with Local History',
      body: 'Click "Download". Watch real-time byte progress as your file streams directly to your device, and manage past links anytime in your private local browser history.'
    }
  ];

  const localRunCommands = `# 1. Clone your repository and install dependencies
git clone https://github.com/your-username/kunu-media-downloader.git
cd kunu-media-downloader
npm install

# 2. Copy environment configuration
cp .env.example .env

# 3. Run unit tests (SSRF & URL validation suite)
npm test

# 4. Start the full-stack Express + Vite server on port 3000
npm run dev`;

  const envExampleSnippet = `PORT=3000
NODE_ENV=production
MAX_DOWNLOAD_BYTES=157286400
UPSTREAM_TIMEOUT_MS=15000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60`;

  return (
    <section aria-labelledby="how-to-use-heading" className="w-full max-w-7xl mx-auto space-y-12">
      {/* Step-by-Step Workflow */}
      <div className="space-y-6">
        <div className="max-w-2xl space-y-2">
          <h2 id="how-to-use-heading" className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
            How to Use Kunu Media Downloader
          </h2>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Follow four straightforward steps to inspect, verify, and download legitimate video and audio streams on Android phones, tablets, laptops, or desktops.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s) => (
            <div
              key={s.num}
              className="bg-[#0e0a1f]/85 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="text-sm font-mono font-bold text-purple-400">{s.num}</div>
                <h3 className="text-base font-bold text-white font-display">{s.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenDownloader}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl transition-all cursor-pointer"
          >
            Go to Media Analyzer & Downloader
          </button>
        </div>
      </div>

      {/* Free Deployment & Architecture Guide (GitHub, Vercel, and Full-Stack Node.js) */}
      <div className="bg-[#0e0a1f]/90 border border-purple-500/20 rounded-2xl p-6 md:p-8 space-y-8">
        <div className="space-y-2 max-w-3xl">
          <h3 className="text-xl md:text-2xl font-bold text-white font-display">
            Step-by-Step Local Run, GitHub & Free Cloud Deployment Guide
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            This project is pre-configured with <code className="text-purple-300">vercel.json</code>, <code className="text-purple-300">.env.example</code>, and production <code className="text-purple-300">package.json</code> scripts. Read the architectural comparison below to choose the right free hosting tier for your workload.
          </p>
        </div>

        {/* Architectural Comparison Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-[#070510] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-purple-300 text-sm font-semibold">
              <Globe className="w-4 h-4 shrink-0" />
              <span>Option A: Vercel (Frontend + Edge)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ideal for instant GitHub integration, static SPA hosting, and direct browser-supported CORS downloads.
            </p>
            <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
              <p><strong className="text-amber-300">Vercel Hobby Limits:</strong></p>
              <p>· Serverless functions time out after 10 seconds.</p>
              <p>· Response payload cap is 4.5 MB per function invocation.</p>
              <p>· Use Render or Railway for full backend proxy streaming up to 150 MB.</p>
            </div>
          </div>

          <div className="bg-[#070510] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-blue-300 text-sm font-semibold">
              <Server className="w-4 h-4 shrink-0" />
              <span>Option B: Render / Railway / Fly.io (Full-Stack)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Recommended for running the full Express backend (<code className="text-slate-200">/api/analyze</code> and <code className="text-slate-200">/api/stream</code> up to 150 MB with HTTP Range support).
            </p>
            <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
              <p><strong className="text-emerald-300">Render Deployment Settings:</strong></p>
              <p>· Supports continuous HTTP byte streaming without a 4.5 MB buffer cap.</p>
              <p>· Build command: <code className="text-slate-200">npm install && npm run build</code></p>
              <p>· Start command: <code className="text-slate-200">npm start</code></p>
            </div>
          </div>

          <div className="bg-[#070510] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Security Hardening Included</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Built-in protection against Server-Side Request Forgery (SSRF) and resource exhaustion out of the box.
            </p>
            <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
              <p>· Blocks <code className="text-slate-200">localhost</code>, <code className="text-slate-200">127.0.0.0/8</code>, <code className="text-slate-200">10.0.0.0/8</code>, <code className="text-slate-200">192.168.0.0/16</code>, and cloud metadata (<code className="text-slate-200">169.254.169.254</code>).</p>
              <p>· Verifies DNS A/AAAA records on every redirect hop.</p>
              <p>· Enforces IP rate limiting and 15s upstream timeouts.</p>
            </div>
          </div>
        </div>

        {/* Terminal Commands & Environment Setup */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#070510] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>Local Development & Test Commands</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCode('local-cmds', localRunCommands)}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-md flex items-center gap-1 cursor-pointer"
              >
                {copiedCmd === 'local-cmds' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd === 'local-cmds' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed p-3 bg-[#05030a] rounded-lg border border-slate-800/80">
              {localRunCommands}
            </pre>
          </div>

          <div className="bg-[#070510] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Server className="w-4 h-4 text-blue-400" />
                <span>Environment Variables (.env.example)</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyCode('env-vars', envExampleSnippet)}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-md flex items-center gap-1 cursor-pointer"
              >
                {copiedCmd === 'env-vars' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCmd === 'env-vars' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed p-3 bg-[#05030a] rounded-lg border border-slate-800/80">
              {envExampleSnippet}
            </pre>
            <p className="text-xs text-slate-400">
              No paid API keys are required. All direct media inspections, public oEmbed queries, and SSRF protections run with zero external API billing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
