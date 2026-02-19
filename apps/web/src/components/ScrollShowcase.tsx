"use client";

import { Hero } from "@/components/Hero";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const sections = [
  {
    title: "Collect",
    description:
      "Gather comments from any TikTok profile or set of videos. Filter, search, and organize thousands of comments effortlessly.",
    accent: "text-accent-cyan-text",
    video: "/videos/collect-compressed.mp4",
    videoHd: "/videos/collect-hd.mp4",
  },
  {
    title: "Analyze",
    description:
      "Understand audiences at a glance. Translate comments, identify common themes, and surface the conversations that matter.",
    accent: "text-accent-pink",
    video: "/videos/analyze-compressed.mp4",
    videoHd: "/videos/analyze-hd.mp4",
  },
  {
    title: "Reply",
    description:
      "Respond to your community in bulk with personalized, translated replies. Use mass global engagement to spur growth.",
    accent: "text-accent-cyan-text",
    video: "/videos/reply-compressed.mp4",
    videoHd: "/videos/reply-hd.mp4",
  },
] as const;

function SectionVideo({ src, onOpen }: { src: string; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button onClick={onOpen} className="group relative block w-full cursor-pointer">
      {!loaded && (
        <div className="absolute inset-0 z-10 rounded-2xl border border-border bg-gradient-to-br from-accent-cyan/10 via-transparent to-accent-pink/10" />
      )}
      <video
        className={`aspect-video w-full rounded-2xl bg-elevated border border-border object-cover shadow-lg shadow-black/10 pointer-events-none ${!loaded ? "invisible" : ""}`}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        onPlaying={() => setLoaded(true)}
      />
      <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <svg
          className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
        </svg>
      </div>
    </button>
  );
}

function VideoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl"
      onClick={onClose}
    >
      <div className="relative w-full max-w-7xl mx-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors text-sm"
        >
          Close
        </button>
        <video
          className="aspect-video w-full rounded-2xl bg-elevated object-cover"
          src={src}
          autoPlay
          loop
          muted
          playsInline
          controls
        />
      </div>
    </div>,
    document.body,
  );
}

export function ScrollShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const videoRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setVideoRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      videoRefs.current[index] = el;
    },
    [],
  );

  useEffect(() => {
    function update() {
      const elements = videoRefs.current.filter(Boolean) as HTMLDivElement[];
      if (elements.length === 0) return;

      const viewportCenter = window.innerHeight / 2;
      let closest = 0;
      let closestDist = Infinity;

      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        const elCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elCenter - viewportCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      }

      setActiveIndex(closest);
    }

    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div>
      <div className="pt-20 pb-16 px-6">
        <Hero />
      </div>

      {/* Mobile: text + video together per section */}
      <div className="md:hidden px-6 pb-32 space-y-16">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className={`text-3xl font-bold ${section.accent}`}>
              {section.title}
            </h2>
            <p className="mt-3 text-base text-foreground-muted leading-relaxed">
              {section.description}
            </p>
            <div className="mt-6">
              <SectionVideo src={section.video} onOpen={() => setLightboxSrc(section.videoHd)} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: sticky text column + scrolling videos */}
      <div className="hidden md:block max-w-[1300px] mx-auto px-6 pb-32">
        <div className="grid md:grid-cols-[3fr_5fr] md:gap-12">
          <div className="relative">
            <div className="md:sticky md:top-1/3 xl:pt-32">
              {sections.map((section, i) => (
                <div
                  key={section.title}
                  className={i === 0 ? "" : "absolute inset-0 xl:mt-32"}
                  style={{
                    opacity: activeIndex === i ? 1 : 0,
                    transition: "opacity 0.3s ease-out",
                  }}
                  aria-hidden={activeIndex !== i}
                >
                  <h2 className={`text-4xl font-bold ${section.accent}`}>
                    {section.title}
                  </h2>
                  <p className="mt-4 text-lg text-foreground-muted leading-relaxed">
                    {section.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            {sections.map((_, i) => (
              <div
                key={i}
                ref={setVideoRef(i)}
                className={i < sections.length - 1 ? "mb-16" : ""}
                style={{ minHeight: 1500 }}
              >
                <div className="md:sticky md:top-1/3">
                  <SectionVideo src={sections[i].video} onOpen={() => setLightboxSrc(sections[i].videoHd)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {lightboxSrc && (
        <VideoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </div>
  );
}
