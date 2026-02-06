import { APP_NAME, SUPPORT_EMAIL } from "@/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-content bg-surface">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-foreground-muted text-sm">
          Last updated: February 5, 2025
        </p>

        <div className="mt-10 space-y-8 text-foreground-muted leading-relaxed">
          <Section title="Overview">
            <p>
              {APP_NAME} is a Chrome extension and companion web app that helps
              TikTok creators manage engagement by collecting comments, sending
              replies, and tracking activity. This policy explains what data we
              collect, how it is stored, and your rights.
            </p>
          </Section>

          <Section title="What Data We Collect">
            <p>
              When you use {APP_NAME} to collect comments from TikTok videos, we
              store the following data:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <strong className="text-foreground">Comment data</strong> — user
                handles, display names, comment text, timestamps, profile URLs,
                and avatar URLs
              </li>
              <li>
                <strong className="text-foreground">Video metadata</strong> —
                video IDs, video URLs, thumbnail URLs, and profile handles
              </li>
              <li>
                <strong className="text-foreground">Reply activity</strong> —
                which comments you have replied to and when
              </li>
              <li>
                <strong className="text-foreground">
                  Authentication tokens
                </strong>{" "}
                — session tokens for signing in to the dashboard
              </li>
              <li>
                <strong className="text-foreground">User preferences</strong> —
                settings such as comment limits, post limits, and your TikTok
                handle
              </li>
            </ul>
          </Section>

          <Section title="How Data Is Stored">
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-foreground">Locally</strong> —
                Authentication tokens and ephemeral scraping state are stored in
                Chrome extension local storage on your device.
              </li>
              <li>
                <strong className="text-foreground">Remotely</strong> — Comment
                data, video metadata, settings, and reply activity are stored on
                our backend (powered by Convex). All data is transmitted over
                HTTPS and encrypted in transit.
              </li>
            </ul>
          </Section>

          <Section title="How Data Is Used">
            <p>Your data is used solely to provide {APP_NAME} functionality:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Displaying collected comments in your dashboard</li>
              <li>Sending replies to comments on your behalf</li>
              <li>Tracking which comments you have already replied to</li>
              <li>Filtering out unwanted comments via the ignore list</li>
              <li>Syncing your data across devices when signed in</li>
            </ul>
            <p className="mt-2">
              We do not sell, share, or use your data for advertising or
              analytics beyond basic usage metrics.
            </p>
          </Section>

          <Section title="Third-Party Services">
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-foreground">Convex</strong> — Backend
                database and API hosting.{" "}
                <a
                  href="https://www.convex.dev/legal/privacy/v2024-03-21"
                  className="text-accent-cyan-text hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Convex Privacy Policy
                </a>
              </li>
              <li>
                <strong className="text-foreground">Clerk</strong> —
                Authentication and user management for the web dashboard.{" "}
                <a
                  href="https://clerk.com/privacy"
                  className="text-accent-cyan-text hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Clerk Privacy Policy
                </a>
              </li>
              <li>
                <strong className="text-foreground">Vercel</strong> — Web app
                hosting and analytics.{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  className="text-accent-cyan-text hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Vercel Privacy Policy
                </a>
              </li>
            </ul>
          </Section>

          <Section title="Data Retention">
            <p>
              Your data is stored for as long as your account exists. You can
              delete individual comments, videos, or all of your data at any
              time from the dashboard. When you delete data, it is permanently
              removed from our servers.
            </p>
          </Section>

          <Section title="Your Rights">
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-foreground">Access</strong> — All your
                data is visible in the {APP_NAME} dashboard.
              </li>
              <li>
                <strong className="text-foreground">Deletion</strong> — You can
                delete any or all of your data from the dashboard at any time.
              </li>
              <li>
                <strong className="text-foreground">Portability</strong> — Your
                comment and video data can be exported from the dashboard.
              </li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              If you have questions about this privacy policy or your data,
              please contact us at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-accent-cyan-text hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}
