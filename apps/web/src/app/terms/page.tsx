import { APP_NAME, SUPPORT_EMAIL } from "@/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
};

export default function TermsOfService() {
  return (
    <div className="min-h-content bg-surface">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-foreground-muted text-sm">
          Last updated: February 5, 2025
        </p>

        <div className="mt-10 space-y-8 text-foreground-muted leading-relaxed">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using {APP_NAME} (the &ldquo;Service&rdquo;),
              including the Chrome extension and companion web application, you
              agree to be bound by these Terms of Service. If you do not agree to
              these terms, do not use the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              {APP_NAME} is a browser-based tool that helps users manage TikTok
              engagement by collecting publicly visible comment data, facilitating
              replies, and organizing activity through a dashboard interface. The
              Service is provided &ldquo;as is&rdquo; and &ldquo;as
              available.&rdquo;
            </p>
          </Section>

          <Section title="3. No Affiliation with TikTok">
            <p>
              {APP_NAME} is an independent product and is not affiliated with,
              endorsed by, sponsored by, or in any way officially connected with
              TikTok, ByteDance Ltd., or any of their subsidiaries or affiliates.
              The TikTok name, trademarks, and logos are the property of their
              respective owners. Any references to TikTok within the Service are
              for descriptive purposes only.
            </p>
          </Section>

          <Section title="4. Use at Your Own Risk">
            <p>
              You acknowledge and agree that your use of the Service is entirely
              at your own risk. {APP_NAME} interacts with third-party platforms
              that may have their own terms of service, usage policies, and rate
              limits. You are solely responsible for ensuring that your use of
              {" "}{APP_NAME} complies with all applicable third-party terms and
              policies.
            </p>
            <p className="mt-2">
              {APP_NAME} shall not be held liable for any consequences arising
              from your use of the Service, including but not limited to account
              restrictions, suspensions, or terminations imposed by third-party
              platforms. You assume all risk associated with the use of automated
              or semi-automated tools on third-party services.
            </p>
          </Section>

          <Section title="5. Service Availability and Third-Party Dependencies">
            <p>
              The Service relies on the structure and availability of third-party
              websites and APIs. Changes to these external platforms, including
              but not limited to layout modifications, API changes, rate limiting,
              or access restrictions, may cause degradation, interruption, or
              temporary unavailability of the Service for extended periods.
            </p>
            <p className="mt-2">
              {APP_NAME} makes no guarantee of uninterrupted or error-free
              operation and shall not be liable for any loss or inconvenience
              caused by Service disruptions resulting from third-party platform
              changes.
            </p>
          </Section>

          <Section title="6. User Accounts">
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activity that occurs under your
              account. You agree to notify us immediately of any unauthorized use
              of your account.
            </p>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Distribute spam, unsolicited messages, or harassing content</li>
              <li>
                Attempt to reverse engineer, decompile, or disassemble the
                Service
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the
                Service
              </li>
            </ul>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              The Service, including its original content, features, and
              functionality, is owned by {APP_NAME} and is protected by
              applicable intellectual property laws. You may not copy, modify,
              distribute, or create derivative works based on the Service without
              prior written consent.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, {APP_NAME} and
              its operators shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including but not
              limited to loss of data, revenue, or profits, arising out of or
              related to your use of the Service.
            </p>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p>
              The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; basis without warranties of any kind, whether
              express or implied, including but not limited to implied warranties
              of merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
          </Section>

          <Section title="11. Modifications to Terms">
            <p>
              We reserve the right to modify these terms at any time. Changes
              will be effective immediately upon posting to this page. Your
              continued use of the Service after changes are posted constitutes
              your acceptance of the revised terms.
            </p>
          </Section>

          <Section title="12. Termination">
            <p>
              We may terminate or suspend your access to the Service at any time,
              without prior notice or liability, for any reason, including breach
              of these terms. Upon termination, your right to use the Service
              will immediately cease.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              If you have questions about these terms, please contact us at{" "}
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
