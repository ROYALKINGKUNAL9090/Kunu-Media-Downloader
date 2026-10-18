import React, { useState } from 'react';
import { PLATFORMS, PlatformInfo } from '../utils/mediaValidator';
import { ArrowUpRight, CheckCircle2, Info, Lock } from 'lucide-react';

interface PlatformsSectionProps {
  onSelectSampleUrl: (url: string) => void;
}

export const PlatformsSection: React.FC<PlatformsSectionProps> = ({ onSelectSampleUrl }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Direct File', 'Video Platform', 'Social Media', 'Messaging'];

  const filteredPlatforms =
    selectedCategory === 'All'
      ? PLATFORMS
      : PLATFORMS.filter((p) => p.category === selectedCategory);

  const renderStatusIcon = (status: PlatformInfo['supportStatus']) => {
    if (status === 'direct_supported') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (status === 'public_metadata_only') {
      return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    return <Lock className="w-4 h-4 text-amber-400 shrink-0" />;
  };

  return (
    <section aria-labelledby="platforms-heading" className="w-full max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl space-y-2">
          <h2 id="platforms-heading" className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
            Supported Platforms & Source Detection Matrix
          </h2>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Kunu Media Downloader inspects 13 major media ecosystems and direct file servers. We never fabricate download capabilities or bypass DRM, authentication walls, or creator access controls.
          </p>
        </div>

        {/* Interactive Category Filter Controls */}
        <div
          role="group"
          aria-label="Filter platforms by category"
          className="flex flex-wrap items-center gap-1 p-1 bg-[#0e0a1f] border border-slate-800 rounded-xl self-start"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPlatforms.map((platform) => (
          <article
            key={platform.id}
            className="bg-[#0e0a1f]/85 border border-slate-800/90 hover:border-purple-500/35 rounded-2xl p-6 flex flex-col justify-between gap-5 transition-colors"
          >
            <div className="space-y-3">
              {/* Unboxed quiet metadata header (Zero-Pill discipline) */}
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span>{platform.category}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      platform.supportStatus === 'direct_supported'
                        ? 'text-emerald-300 font-medium'
                        : platform.supportStatus === 'public_metadata_only'
                        ? 'text-blue-300 font-medium'
                        : 'text-amber-300 font-medium'
                    }
                  >
                    {platform.statusLabel}
                  </span>
                </div>
                {renderStatusIcon(platform.supportStatus)}
              </div>

              <h3 className="text-lg font-bold text-white font-display">
                {platform.name}
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed">
                {platform.description}
              </p>

              <div className="pt-2 border-t border-slate-800/70 space-y-2 text-xs">
                <p className="text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">Technical Policy:</strong> {platform.technicalLimitation}
                </p>
                <p className="text-slate-400 leading-relaxed">
                  <strong className="text-purple-300">Recommended Path:</strong> {platform.supportedAlternative}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-slate-400 truncate">
                {platform.domains.slice(0, 2).join(', ')}
              </span>

              <button
                type="button"
                onClick={() => onSelectSampleUrl(platform.exampleUrl)}
                className="px-3 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Test Source</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
