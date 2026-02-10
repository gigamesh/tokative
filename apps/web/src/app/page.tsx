import { LinkButton } from "@/components/Button";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tokative",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <div className="min-h-content bg-surface overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <main className="max-w-5xl mx-auto px-6 relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-r from-accent-cyan/20 via-transparent to-accent-pink/20 blur-3xl rounded-full pointer-events-none" />

        <section className="pt-32 pb-16 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tight">
              <span className="text-gradient-brand">Tokative</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-foreground-muted leading-relaxed max-w-xl mx-auto text-balance">
              Manage TikTok engagement at scale. Collect comments, reply in
              bulk, and track everything in one place.
            </p>
            <div className="mt-10">
              <LinkButton
                href="/sign-in"
                variant="primary"
                size="lg"
                pill
                className="group hover:scale-105"
              >
                Try It Out For Free
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </LinkButton>
            </div>
          </div>
        </section>

        <section className="py-8 relative">
          <h2 className="sr-only">How It Works</h2>
          <div className="grid sm:grid-cols-3 gap-16 sm:gap-12">
            <FeatureCard
              number="01"
              title="Collect"
              description="Gather comments from any TikTok video with our Chrome extension. Automatic spam filtering included."
              accent="cyan"
            />
            <FeatureCard
              number="02"
              title="Reply"
              description="Send personalized responses to multiple comments at once. Engage your audience efficiently."
              accent="pink"
            />
            <FeatureCard
              number="03"
              title="Track"
              description="Monitor your progress across videos. See what you've replied to and what's pending."
              accent="cyan"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  number,
  title,
  description,
  accent,
}: {
  number: string;
  title: string;
  description: string;
  accent: "cyan" | "pink";
}) {
  const accentColor =
    accent === "cyan" ? "text-accent-cyan-text" : "text-accent-pink";

  return (
    <div className="group">
      <div className="text-center">
        <span className={`text-xs font-mono ${accentColor}`}>{number}</span>
        <h3 className="mt-2 text-lg font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-3 text-foreground-muted leading-relaxed text-center">
        {description}
      </p>
    </div>
  );
}
