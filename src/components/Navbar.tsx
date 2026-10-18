import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type PageId =
  | 'home'
  | 'downloader'
  | 'platforms'
  | 'how-to-use'
  | 'faq'
  | 'privacy'
  | 'terms'
  | 'contact';

interface NavbarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activePage, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryLinks: Array<{ id: PageId; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'downloader', label: 'Downloader' },
    { id: 'platforms', label: 'Supported Platforms' },
    { id: 'how-to-use', label: 'How to Use' },
    { id: 'faq', label: 'FAQ' }
  ];

  const secondaryLinks: Array<{ id: PageId; label: string }> = [
    { id: 'privacy', label: 'Privacy Policy' },
    { id: 'terms', label: 'Terms of Service' },
    { id: 'contact', label: 'Contact' }
  ];

  const handleNav = (id: PageId) => {
    onNavigate(id);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-[#070510]/85 backdrop-blur-md border-b border-purple-500/15">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 md:gap-8 px-4 sm:px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="text-base sm:text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0 hover:text-purple-300 transition-colors focus-visible:outline-2 focus-visible:outline-purple-500 rounded cursor-pointer"
        >
          Kunu Media Downloader
        </button>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          {primaryLinks.map((link) => {
            const isActive = activePage === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNav(link.id)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 cursor-pointer ${
                  isActive
                    ? 'text-white border-purple-400'
                    : 'text-slate-300 border-transparent hover:text-white hover:border-purple-500/40'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action (+ mobile menu trigger on small screens) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('downloader')}
            className="hidden sm:inline-flex px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg transition-all whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
          >
            Launch Downloader
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 text-slate-200 hover:text-white rounded-lg border border-slate-800 bg-slate-900/80"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0c081d] border-b border-purple-500/20 px-6 py-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {[...primaryLinks, ...secondaryLinks].map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNav(link.id)}
                className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activePage === link.id
                    ? 'bg-purple-600/20 text-purple-200 border border-purple-500/30'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
