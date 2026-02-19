import { EarlyAccessForm } from "@/components/EarlyAccessForm";

export function Hero() {
  return (
    <div className="relative text-center px-6 pb-12 mt-16">
      <h1 className="text-5xl sm:text-6xl text-gradient-brand max-w-xl mx-auto">
        Manage TikTok engagement at scale
      </h1>
      <p className="mt-10 text-lg sm:text-xl text-foreground-muted leading-relaxed max-w-xl mx-auto text-balance">
        Collect comments, understand your audience, and reply in bulk — all from
        one dashboard.
      </p>
      <div className="mt-12">
        <EarlyAccessForm />
      </div>
    </div>
  );
}
