import Link from "next/link";
import { ArrowLeft, Database, ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "1. Information We Collect",
    body: [
      "We may collect account information such as email address, profile details, authentication identifiers, plan status, and login metadata.",
      "We may collect usage information such as pages visited, feature activity, research runs, prompts, generated reports, saved preferences, device and browser details, error logs, and approximate technical location derived from network data.",
      "If you connect integrations or enter API keys, portfolio inputs, watchlists, tickers, research instructions, or uploaded content, we process that information to provide the requested product functionality.",
    ],
  },
  {
    title: "2. How We Use Information",
    body: [
      "We use information to authenticate users, operate the product, generate research workflows, provide market and portfolio features, manage entitlements, support billing, improve reliability, secure the service, and respond to support requests.",
      "We may use aggregated or de-identified information to understand usage patterns, improve models and workflows, debug performance, and develop new features.",
    ],
  },
  {
    title: "3. AI Processing and Research Content",
    body: [
      "Prompts, ticker requests, portfolio inputs, research runs, and generated outputs may be processed by internal systems and third-party model or data providers where needed to deliver the service.",
      "Do not submit secrets, private keys, regulated personal data, or confidential third-party information unless you have the right to do so and the feature explicitly supports that use.",
    ],
  },
  {
    title: "4. Sharing and Service Providers",
    body: [
      "We may share information with service providers that help operate authentication, hosting, analytics, payments, support, market data, AI model processing, email delivery, and security.",
      "We may disclose information when required by law, to protect rights and safety, to investigate abuse, or as part of a business transfer such as a merger, financing, or acquisition.",
      "Public shared research reports may expose report content, ticker, analysis date, selected safe metadata, and final decision fields. Private user metadata and secrets should not be exposed in public share views.",
    ],
  },
  {
    title: "5. Cookies and Local Storage",
    body: [
      "We use browser storage and cookies for authentication sessions, preferences, local chat history, product state, and security. Some third-party providers may set their own cookies during authentication or payment flows.",
      "You can control cookies through your browser, but disabling them may prevent sign-in or core product functionality from working correctly.",
    ],
  },
  {
    title: "6. Retention",
    body: [
      "We retain information for as long as needed to provide the service, maintain account records, satisfy legal obligations, resolve disputes, prevent abuse, and improve product reliability.",
      "Guest or public demo data may be temporary, limited, or stored locally depending on the feature. Signed-in research runs and saved reports may remain available in your account unless deleted or removed under applicable retention rules.",
    ],
  },
  {
    title: "7. Security",
    body: [
      "We use reasonable technical and organizational safeguards designed to protect information. No internet service can guarantee absolute security.",
      "You are responsible for keeping your password, OAuth account, device, and any personal API keys secure.",
    ],
  },
  {
    title: "8. Your Choices and Rights",
    body: [
      "Depending on your location, you may have rights to access, correct, delete, export, restrict, or object to certain processing of your personal information.",
      "You can contact us to request help with account or privacy questions. We may need to verify your identity before fulfilling a request.",
    ],
  },
  {
    title: "9. International Use",
    body: [
      "The service may be operated from and processed in jurisdictions different from where you live. By using the service, you understand that information may be transferred and processed where our providers operate.",
    ],
  },
  {
    title: "10. Contact",
    body: [
      "Privacy questions can be sent to support@quantumadvisor.app.",
      "This Privacy Policy is a product policy draft for the platform and should be reviewed by qualified counsel before production use.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#06080d] px-6 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <header className="mt-10 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-primary/14 text-indigo-200 ring-1 ring-indigo-primary/25">
            <Database className="size-6" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-indigo-primary">Privacy Policy</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Quanfora Privacy Policy</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/52">
            Last updated June 18, 2026. This policy explains how Quanfora collects, uses, shares, and protects information.
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-indigo-primary/20 bg-indigo-primary/10 p-4 text-sm leading-6 text-indigo-50/78">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo-primary" />
            <p>Do not enter secrets, private keys, or sensitive regulated information unless a feature explicitly supports that workflow.</p>
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
