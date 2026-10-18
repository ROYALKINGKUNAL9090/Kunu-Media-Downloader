import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search, CheckCircle2, AlertCircle, Send } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
  category: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    category: 'Supported Media',
    q: 'What types of URLs can Kunu Media Downloader download directly?',
    a: 'Kunu Media Downloader supports publicly accessible direct HTTP and HTTPS media files—specifically MP4, WebM, MP3, WAV, OGG, and M4A—where you own the file or have permission from the copyright holder to download it.'
  },
  {
    category: 'Platform Policy',
    q: 'Why do YouTube, Instagram, Facebook, or TikTok links show oEmbed metadata or platform notices instead of direct video extraction?',
    a: 'Major platforms protect streams using encrypted DASH/HLS manifests, signed session cookies, and Terms of Service restrictions (such as YouTube ToS Section 5.B). Kunu Media Downloader does not bypass DRM, paywalls, authentication walls, or creator download restrictions. Instead, we query official public oEmbed metadata where available and guide you to each platform’s legitimate download feature (e.g., YouTube Studio, Meta Accounts Center, or TikTok Save Video).'
  },
  {
    category: 'Quality & Audio',
    q: 'How are quality options (144p to 2160p 4K) and audio formats determined?',
    a: 'We never invent fake quality buttons. When you analyze a direct media URL, our engine inspects the actual stream headers and intrinsic video dimensions. It displays Original Quality plus only those resolutions at or below the source’s real resolution, alongside MP3, M4A, WAV, and OGG audio formats when FFmpeg processing is available on the server.'
  },
  {
    category: 'CORS & Streaming',
    q: 'Why can’t browser JavaScript directly download every cross-origin file without a backend?',
    a: 'Web browsers enforce Cross-Origin Resource Sharing (CORS) policies. If a third-party server does not include an Access-Control-Allow-Origin header, client-side fetch() requests are blocked by the browser. Our Express backend provides a secure /api/stream endpoint that streams permitted public media files with proper Content-Disposition attachment headers.'
  },
  {
    category: 'Security',
    q: 'How does Kunu Media Downloader protect against Server-Side Request Forgery (SSRF)?',
    a: 'Every URL submitted to /api/analyze, /api/stream, or /api/convert is validated to allow only http:// and https:// schemes, reject embedded credentials, block localhost and private IPv4/IPv6 ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254), and verify DNS resolution on every redirect hop.'
  },
  {
    category: 'Deployment',
    q: 'Can I deploy this application to Vercel and GitHub for free?',
    a: 'Yes. You can push the repository to GitHub and deploy the frontend to Vercel for free. Keep in mind that Vercel Hobby serverless functions enforce a 10-second timeout, a 4.5 MB response payload limit, and do not provide a persistent FFmpeg binary for large video conversions. For full 150 MB streaming and FFmpeg audio conversion, deploy server.ts on Render, Railway, or Fly.io.'
  }
];

export const FAQSection: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = FAQ_ITEMS.filter(
    (item) =>
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section aria-labelledby="faq-heading" className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 id="faq-heading" className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm md:text-base text-slate-300">
            Clear technical answers about direct media downloading, CORS, SSRF security, and serverless deployment.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <label htmlFor="faq-search-input" className="sr-only">
            Search FAQ
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="faq-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter questions..."
            className="w-full bg-[#0e0a1f] border border-slate-800 focus:border-purple-400 focus:outline-none rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="p-8 text-center bg-[#0e0a1f]/70 border border-slate-800 rounded-2xl text-sm text-slate-400">
            No FAQ entries matched "{searchQuery}". Try another keyword.
          </div>
        ) : (
          filteredFaqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={item.q}
                className="bg-[#0e0a1f]/85 border border-slate-800 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="text-xs text-purple-300 font-medium">{item.category}</div>
                    <div className="text-base font-bold text-white font-display">{item.q}</div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-purple-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <section aria-labelledby="privacy-heading" className="w-full max-w-4xl mx-auto bg-[#0e0a1f]/90 border border-slate-800 rounded-2xl p-6 md:p-10 space-y-6">
      <div className="border-b border-slate-800 pb-5 space-y-2">
        <div className="text-xs text-slate-400 font-mono">Effective Date: October 2026 · Kunu Media Downloader</div>
        <h1 id="privacy-heading" className="text-2xl md:text-3xl font-bold text-white font-display">
          Privacy Policy
        </h1>
      </div>

      <div className="space-y-5 text-sm text-slate-300 leading-relaxed">
        <div className="space-y-2">
          <h2 className="text-base font-bold text-white font-display">01. Local-First Download History</h2>
          <p>
            Your download history is stored exclusively inside your own web browser’s <code className="text-purple-300">localStorage</code> on your device. Kunu Media Downloader does not maintain a cloud database of the URLs you analyze or the files you download. You can clear your local history at any time with a single click using the "Clear History" button.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-bold text-white font-display">02. Ephemeral Stream Processing & Temporary File Cleanup</h2>
          <p>
            When you inspect or stream a direct media link through our backend, the server processes headers and media chunks in memory. When optional server-side FFmpeg format conversion is invoked for permitted files, temporary artifacts are written to an isolated system temporary directory and automatically deleted immediately after the stream completes or within a strict 5-minute garbage-collection window.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-bold text-white font-display">03. Rate Limiting & Security Protection</h2>
          <p>
            To protect the service against abuse and Denial-of-Service attacks, client IP addresses are held transiently in volatile memory for a 60-second sliding window rate limiter and purged automatically once the window expires.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-bold text-white font-display">04. No Third-Party Advertising Trackers</h2>
          <p>
            We do not sell user data, embed invasive advertising pixels, or require account registration to analyze or download legitimate direct media files.
          </p>
        </div>
      </div>
    </section>
  );
};

export const TermsOfServicePage: React.FC = () => {
  return (
    <section aria-labelledby="terms-heading" className="w-full max-w-4xl mx-auto bg-[#0e0a1f]/90 border border-slate-800 rounded-2xl p-6 md:p-10 space-y-6">
      <div className="border-b border-slate-800 pb-5 space-y-2">
        <div className="text-xs text-slate-400 font-mono">Last Updated: October 2026 · Legal Agreement</div>
        <h1 id="terms-heading" className="text-2xl md:text-3xl font-bold text-white font-display">
          Terms of Service
        </h1>
      </div>

      <div className="space-y-5 text-sm text-slate-300 leading-relaxed">
        <div className="space-y-2">
          <h2 className="text-base font-bold text-white font-display">01. Permitted Use & Copyright Responsibility</h2>
          <p>
            Kunu Media Downloader is designed solely for downloading and inspecting publicly accessible direct media files that you own, have created, or have explicit permission from the copyright holder to download (including Creative Commons, public domain, and self-hosted media). Users are solely responsible for complying with applicable copyright laws and the Terms of Service of any third-party website.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-bold text-white font-display">02. Strict Prohibition on DRM & Access Control Circumvention</h2>
          <p>
            This platform does not—and may not be used to—bypass Digital Rights Management (DRM), decryption keys, private account authentication, paywalls, or platform anti-scraping protections.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-bold text-white font-display">03. Network Security & SSRF Restrictions</h2>
          <p>
            Attempting to probe internal networks, localhost ports, private IPv4/IPv6 ranges, or cloud metadata services via the URL analyzer is strictly prohibited and automatically blocked by our SSRF security filters.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-bold text-white font-display">04. Disclaimer of Warranties</h2>
          <p>
            The software is provided "as is" without warranties of any kind. Availability of upstream third-party media servers, oEmbed APIs, and cross-origin headers is controlled by the respective external hosts.
          </p>
        </div>
      </div>
    </section>
  );
};

export const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Direct Media Support');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMsg = message.trim();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (cleanMsg.length < 10) {
      setError('Please enter a message with at least 10 characters.');
      return;
    }

    setSubmitted(true);
  };

  return (
    <section aria-labelledby="contact-heading" className="w-full max-w-3xl mx-auto bg-[#0e0a1f]/90 border border-slate-800 rounded-2xl p-6 md:p-10 space-y-6">
      <div className="space-y-2">
        <h1 id="contact-heading" className="text-2xl md:text-3xl font-bold text-white font-display">
          Contact & Technical Support
        </h1>
        <p className="text-sm text-slate-300">
          Have questions about direct media compatibility, copyright compliance, or self-hosting Kunu Media Downloader? Send us a message below.
        </p>
      </div>

      {submitted ? (
        <div className="p-6 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-3">
          <div className="flex items-center gap-2 text-emerald-300 font-semibold text-base">
            <CheckCircle2 className="w-5 h-5" />
            <span>Message Received</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            Thank you, <strong>{name}</strong>. Your inquiry regarding <strong>{topic}</strong> has been logged. We will respond to <strong>{email}</strong> shortly.
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setName('');
              setEmail('');
              setMessage('');
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Send Another Message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div role="alert" className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="contact-name" className="block text-xs font-medium text-slate-300">
                Your Name
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kunal Gochhayat"
                className="w-full bg-[#070510] border border-slate-800 focus:border-purple-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contact-email" className="block text-xs font-medium text-slate-300">
                Email Address
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#070510] border border-slate-800 focus:border-purple-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contact-topic" className="block text-xs font-medium text-slate-300">
              Inquiry Category
            </label>
            <select
              id="contact-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-[#070510] border border-slate-800 focus:border-purple-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white"
            >
              <option value="Direct Media Support">Direct Media URL Compatibility</option>
              <option value="Platform Policy & Copyright">Platform Policy & Copyright Compliance</option>
              <option value="Vercel & Cloud Deployment">Vercel & Cloud Deployment Assistance</option>
              <option value="Security & SSRF Report">Security / SSRF Report</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contact-message" className="block text-xs font-medium text-slate-300">
              Message
            </label>
            <textarea
              id="contact-message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the media URL format, deployment setup, or question..."
              className="w-full bg-[#070510] border border-slate-800 focus:border-purple-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Submit Inquiry</span>
          </button>
        </form>
      )}
    </section>
  );
};
