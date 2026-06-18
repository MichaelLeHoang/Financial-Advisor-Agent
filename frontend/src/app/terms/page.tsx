import Link from "next/link";
import { ArrowLeft, Scale, ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "1. Agreement to These Terms",
    body: [
      "These Terms of Service govern your access to and use of QuanAd, also presented as Quantum Financial Advisor. By creating an account, signing in, or using the platform, you agree to these Terms.",
      "If you use the service on behalf of an organization, you represent that you have authority to bind that organization. If you do not agree, do not use the service.",
    ],
  },
  {
    title: "2. Educational Research Only",
    body: [
      "QuanAd provides financial research software, AI-generated analysis, portfolio analytics, market data views, and workflow tools for educational and informational use.",
      "The service does not provide personalized financial, legal, tax, accounting, or investment advice. AI outputs, model signals, research reports, and Buy/Hold/Sell labels are not guarantees, fiduciary recommendations, or instructions to trade.",
      "You are responsible for independently verifying information, evaluating risks, and deciding whether any action is appropriate for your circumstances.",
    ],
  },
  {
    title: "3. Accounts and Eligibility",
    body: [
      "You must provide accurate account information and keep your login credentials secure. You are responsible for activity that occurs under your account.",
      "The service is intended for users who can enter a binding agreement in their jurisdiction. If you are using the service as a minor, you must have permission from a parent or guardian.",
      "We may suspend or terminate access if we believe an account is being misused, compromised, or operated in a way that creates risk for the platform or other users.",
    ],
  },
  {
    title: "4. Acceptable Use",
    body: [
      "You may not use QuanAd to break the law, manipulate markets, harass others, scrape or overload systems, reverse engineer restricted functionality, bypass usage limits, or interfere with security controls.",
      "You may not represent AI-generated output as guaranteed performance, professional advice, or a direct brokerage execution instruction.",
      "You may not upload content or prompts that contain malware, unlawful material, confidential third-party data you are not authorized to use, or information that violates another person's rights.",
    ],
  },
  {
    title: "5. Market Data, AI Output, and Third-Party Services",
    body: [
      "Market data, news, sentiment, fundamentals, and analytics may come from third-party providers and may be delayed, incomplete, inaccurate, or unavailable.",
      "AI-generated content can contain mistakes, stale assumptions, hallucinations, or reasoning gaps. QuanAd may summarize third-party data, but it does not guarantee that any data source is complete or error-free.",
      "Some features depend on third-party systems such as authentication providers, market data APIs, model providers, payment providers, and hosting platforms. Their own terms may also apply.",
    ],
  },
  {
    title: "6. Subscriptions, Billing, and Feature Access",
    body: [
      "Certain features may require a paid plan, account status, usage allowance, or entitlement. Public and guest access may be restricted to shallow demos or limited functionality.",
      "Billing, renewal, cancellation, and refund terms may be presented at checkout or through the billing provider. Feature access can change as the product evolves.",
    ],
  },
  {
    title: "7. Intellectual Property",
    body: [
      "The platform, interface, software, documentation, workflows, branding, and other service materials are owned by us or our licensors and are protected by applicable intellectual property laws.",
      "Subject to these Terms, you receive a limited, revocable, non-transferable right to use the service for your own lawful research workflow.",
      "You retain ownership of content you submit, but you grant us the rights needed to host, process, secure, display, and operate the service for you.",
    ],
  },
  {
    title: "8. Disclaimers and Limitation of Liability",
    body: [
      "The service is provided on an \"as is\" and \"as available\" basis. We do not warrant uninterrupted access, market data accuracy, model correctness, investment performance, or suitability for any particular purpose.",
      "To the maximum extent permitted by law, we are not liable for trading losses, missed opportunities, lost profits, data delays, data provider errors, model output errors, or indirect, incidental, consequential, special, or punitive damages.",
    ],
  },
  {
    title: "9. Changes and Termination",
    body: [
      "We may modify the service or these Terms as the platform changes. Continued use after updates means you accept the revised Terms.",
      "You may stop using the service at any time. We may suspend or terminate access if required for security, legal compliance, non-payment, misuse, or platform integrity.",
    ],
  },
  {
    title: "10. Contact",
    body: [
      "Questions about these Terms can be sent to support@quantumadvisor.app.",
      "These Terms are a product policy draft for the platform and should be reviewed by qualified counsel before production use.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#06080d] px-6 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/introduction" className="inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white">
          <ArrowLeft className="size-4" /> Back to introduction
        </Link>
        <header className="mt-10 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-primary/14 text-indigo-200 ring-1 ring-indigo-primary/25">
            <Scale className="size-6" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-indigo-primary">Terms of Service</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">QuanAd Terms of Service</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/52">
            Last updated June 18, 2026. These terms explain the rules for using QuanAd as an educational financial research workspace.
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-warning/20 bg-amber-warning/10 p-4 text-sm leading-6 text-amber-50/78">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-warning" />
            <p>QuanAd is not a broker, registered investment adviser, or fiduciary. Research outputs are informational only.</p>
          </div>
        </header>
        <section className="mt-8 space-y-5">
          {sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-indigo-primary">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-white/62">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
