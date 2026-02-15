import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're In! | Tokative",
};

export default function VerifiedPage() {
  return (
    <div className="min-h-content bg-surface overflow-hidden">
      <main className="max-w-5xl mx-auto px-6 relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-r from-accent-cyan/20 via-transparent to-accent-pink/20 blur-3xl rounded-full pointer-events-none" />

        <section className="pt-32 pb-16 relative">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-cyan-500/20 mb-6">
              <svg className="w-8 h-8 text-accent-cyan-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              You&apos;re on the list!
            </h1>
            <p className="mt-6 text-lg text-foreground-muted leading-relaxed max-w-md mx-auto">
              Your email is confirmed. We&apos;ll reach out when we launch with
              your free premium access.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
