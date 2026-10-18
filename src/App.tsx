/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Navbar, PageId } from './components/Navbar';
import { DownloaderWorkspace } from './components/DownloaderWorkspace';
import { PlatformsSection } from './components/PlatformsSection';
import { HowToUseAndDeploy } from './components/HowToUseAndDeploy';
import {
  FAQSection,
  PrivacyPolicyPage,
  TermsOfServicePage,
  ContactPage
} from './components/LegalAndSupportPages';
import { ShieldCheck, Film, Music, Globe } from 'lucide-react';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('home');
  const [prefilledUrl, setPrefilledUrl] = useState<string>('');

  const handleSelectSampleAndOpenDownloader = (url: string) => {
    setPrefilledUrl(url);
    setActivePage('downloader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070510] text-slate-100 relative selection:bg-purple-500/30 selection:text-purple-200">
      {/* Subtle Deep-Purple and Electric-Blue Ambient Background Gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] bg-purple-700/15 rounded-full blur-3xl" />
        <div className="absolute top-60 right-1/5 w-[32rem] h-[32rem] bg-blue-700/10 rounded-full blur-3xl" />
      </div>

      {/* Top Navigation Bar */}
      <Navbar activePage={activePage} onNavigate={setActivePage} />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-16">
        {activePage === 'home' && (
          <>
            {/* Hero + Central Downloader Section */}
            <section className="max-w-5xl mx-auto text-center space-y-4">
              <div className="text-xs font-medium text-purple-300 tracking-wide">
                Direct Video & Audio Downloading Platform · MP4 · WebM · MP3 · WAV · OGG · M4A
              </div>

              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white font-display tracking-tight leading-tight max-w-4xl mx-auto"
                style={{ textWrap: 'balance' }}
              >
                Download Authorized Direct Video & Audio Streams with Precision
              </h1>

              <p className="text-sm md:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Inspect upstream MIME headers, verify genuine native resolutions from 144p to 2160p 4K, extract audio tracks, and evaluate platform policies across 13 media networks—backed by SSRF security and zero paid APIs.
              </p>

              {/* Central Downloader Workspace */}
              <div className="text-left pt-2">
                <DownloaderWorkspace initialUrl={prefilledUrl} />
              </div>

              {/* 4-Column Capability Proof Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 text-left">
                <div className="bg-[#0e0a1f]/75 border border-slate-800/90 rounded-xl p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold">
                    <Film className="w-4 h-4" />
                    <span>Authentic Resolutions</span>
                  </div>
                  <div className="text-base font-bold text-white font-display">144p to 2160p 4K</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Displays only verified source qualities and native video dimensions without fabricated options.
                  </p>
                </div>

                <div className="bg-[#0e0a1f]/75 border border-slate-800/90 rounded-xl p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
                    <Music className="w-4 h-4" />
                    <span>Studio Audio Formats</span>
                  </div>
                  <div className="text-base font-bold text-white font-display">MP3, M4A, WAV & OGG</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Download direct audio files or extract audio tracks when server-side FFmpeg is available.
                  </p>
                </div>

                <div className="bg-[#0e0a1f]/75 border border-slate-800/90 rounded-xl p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>SSRF & DNS Guard</span>
                  </div>
                  <div className="text-base font-bold text-white font-display">Hardened Proxy</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Blocks localhost, private subnets, cloud metadata IPs, and unsafe cross-origin redirects.
                  </p>
                </div>

                <div className="bg-[#0e0a1f]/75 border border-slate-800/90 rounded-xl p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold">
                    <Globe className="w-4 h-4" />
                    <span>13 Platform Profiles</span>
                  </div>
                  <div className="text-base font-bold text-white font-display">Transparent Policies</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Detects YouTube, Instagram, TikTok, Vimeo, X, and direct CDNs with clear capability reporting.
                  </p>
                </div>
              </div>
            </section>

            {/* Supported Platforms Matrix */}
            <PlatformsSection onSelectSampleUrl={handleSelectSampleAndOpenDownloader} />

            {/* How to Use & Free Deployment Guide */}
            <HowToUseAndDeploy onTrySample={handleSelectSampleAndOpenDownloader} />

            {/* FAQ Section */}
            <FAQSection />
          </>
        )}

        {activePage === 'downloader' && (
          <div className="space-y-8">
            <div className="max-w-5xl mx-auto space-y-2">
              <div className="text-xs text-purple-300 font-medium">Dedicated Workspace</div>
              <h1 className="text-3xl md:text-4xl font-bold text-white font-display tracking-tight">
                Kunu Media Downloader Workspace
              </h1>
              <p className="text-sm md:text-base text-slate-300 max-w-2xl">
                Analyze direct MP4, WebM, MP3, WAV, OGG, and M4A links, preview streams directly in your browser, and manage your local download history.
              </p>
            </div>
            <DownloaderWorkspace initialUrl={prefilledUrl} />
          </div>
        )}

        {activePage === 'platforms' && (
          <PlatformsSection onSelectSampleUrl={handleSelectSampleAndOpenDownloader} />
        )}

        {activePage === 'how-to-use' && (
          <HowToUseAndDeploy onTrySample={handleSelectSampleAndOpenDownloader} />
        )}

        {activePage === 'faq' && <FAQSection />}

        {activePage === 'privacy' && <PrivacyPolicyPage />}

        {activePage === 'terms' && <TermsOfServicePage />}

        {activePage === 'contact' && <ContactPage />}
      </main>

      {/* Quiet Footer with Complete Page Navigation */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#05030a] mt-20">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="text-base font-bold text-white font-display">
              Kunu Media Downloader
            </div>
            <p className="text-xs text-slate-400">
              Legitimate direct video & audio downloading platform. Respects copyright, creator access controls, and DRM.
            </p>
          </div>

          <nav aria-label="Footer Navigation" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-400">
            <button
              type="button"
              onClick={() => {
                setActivePage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('downloader');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Downloader
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('platforms');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Supported Platforms
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('how-to-use');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              How to Use & Deploy
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('faq');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('privacy');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('terms');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('contact');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Contact
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
