import { APP_NAME, SUPPORT_EMAIL } from "@/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Program Agreement",
  alternates: { canonical: "/affiliate-terms" },
};

export default function AffiliateTermsPage() {
  return (
    <div className="min-h-content bg-surface">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground">
          Affiliate Program Agreement
        </h1>
        <p className="mt-2 text-foreground-muted text-sm">
          Last updated: February 17, 2026
        </p>

        <div className="mt-10 space-y-8 text-foreground-muted leading-relaxed">
          <Section title="1. Program Overview">
            <p>
              The {APP_NAME} Affiliate Program allows approved partners to earn
              a 30% revenue share on subscription payments from customers they
              refer. Commissions are subject to a 60-day hold period before
              payout.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              Participation requires approval by {APP_NAME}. Approved affiliates
              must complete Stripe Connect Express onboarding to receive
              payouts. {APP_NAME} reserves the right to accept or reject any
              application at its sole discretion.
            </p>
          </Section>

          <Section title="3. Commission Structure">
            <p>
              Affiliates earn 30% of the net invoice amount for each billing
              cycle of a referred subscriber. Commissions are calculated on the
              actual amount paid after any discounts, promotions, or credits.
              Trial periods and $0 invoices do not generate commissions.
            </p>
          </Section>

          <Section title="4. Payment">
            <p>
              Commissions enter a 60-day hold period from the date of the
              associated invoice payment. After the hold period, commissions are
              transferred to the affiliate&apos;s Stripe Express account,
              provided the referred subscriber remains on an active paid plan
              and the affiliate remains in good standing.
            </p>
          </Section>

          <Section title="5. Refunds">
            <p>
              If a referred subscriber receives a refund during the 60-day hold
              period, the associated commission is reduced proportionally or
              reversed entirely for full refunds. If a refund occurs after the
              commission has been transferred, the transfer will be reversed.
            </p>
          </Section>

          <Section title="6. Termination">
            <p>
              Either party may terminate the affiliate relationship at any time.
              Upon termination by {APP_NAME}, commissions currently in the
              60-day hold period are voided. Commissions already transferred are
              honored and will not be clawed back (except in cases of fraud or
              refund).
            </p>
          </Section>

          <Section title="7. Prohibited Methods">
            <p>Affiliates must not:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Send spam or unsolicited messages to promote their link</li>
              <li>
                Make misleading claims about {APP_NAME} or its capabilities
              </li>
              <li>Use cookie stuffing, forced clicks, or similar techniques</li>
              <li>
                Refer themselves or accounts they control (self-referral)
              </li>
              <li>
                Bid on {APP_NAME} brand terms in paid search advertising
              </li>
            </ul>
            <p className="mt-2">
              Violation of these rules may result in immediate termination and
              forfeiture of all held commissions.
            </p>
          </Section>

          <Section title="8. Tax Responsibility">
            <p>
              Affiliates are independent contractors and are solely responsible
              for reporting and paying any taxes owed on their commission
              earnings. {APP_NAME} does not withhold taxes and may issue tax
              forms as required by law.
            </p>
          </Section>

          <Section title="9. Independent Contractor">
            <p>
              Nothing in this agreement creates an employment, partnership,
              joint venture, or agency relationship. Affiliates are not
              employees of {APP_NAME} and are not entitled to any employee
              benefits.
            </p>
          </Section>

          <Section title="10. Modifications">
            <p>
              {APP_NAME} reserves the right to modify this agreement, including
              commission rates and hold periods, at any time with 30 days
              written notice. Continued participation after the notice period
              constitutes acceptance of the revised terms.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about the affiliate program? Contact us at{" "}
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
