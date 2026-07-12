"use client";

import Link from "next/link";
import { useEffect, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { IntroductionFooter, IntroductionNav } from "../introduction/components";

const PRODUCT_AREAS = [
  "General feedback",
  "Bug report",
  "Product suggestion",
  "AI research workspace",
  "Portfolio optimization",
  "Risk and validation",
  "Backtesting",
  "Team or enterprise access",
  "Other",
];

const HEADCOUNT_OPTIONS = [
  "Just me",
  "1-10",
  "11-50",
  "51-200",
  "201-1,000",
  "1,001+",
];

function inputClassName(extra = "") {
  return [
    "h-11 w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 text-sm text-white outline-none",
    "transition-colors placeholder:text-white/28 hover:border-white/[0.14]",
    "focus:border-white/35 focus:ring-2 focus:ring-white/10",
    extra,
  ].join(" ");
}

export default function ContactSalesPage() {
  useEffect(() => {
    const previousTheme = document.body.dataset.theme;
    const applyDarkTheme = () => {
      if (document.body.dataset.theme !== "Deep Space") {
        document.body.dataset.theme = "Deep Space";
      }
    };

    applyDarkTheme();
    const observer = new MutationObserver(applyDarkTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      observer.disconnect();
      if (previousTheme) {
        document.body.dataset.theme = previousTheme;
      } else {
        delete document.body.dataset.theme;
      }
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const products = formData.getAll("productAreas").filter(Boolean).join(", ");
    if (!products) {
      event.currentTarget
        .querySelector<HTMLInputElement>('input[name="productAreas"]')
        ?.setCustomValidity("Select at least one product area.");
      event.currentTarget.reportValidity();
      event.currentTarget
        .querySelector<HTMLInputElement>('input[name="productAreas"]')
        ?.setCustomValidity("");
      return;
    }
    const fields = [
      ["Inquiry type", formData.get("inquiryType")],
      ["First name", formData.get("firstName")],
      ["Last name", formData.get("lastName")],
      ["Email", formData.get("email")],
      ["Phone", formData.get("phone")],
      ["Job title", formData.get("jobTitle")],
      ["Company", formData.get("company")],
      ["Website", formData.get("website")],
      ["Product areas", products],
      ["Headcount", formData.get("headcount")],
      ["Expected usage", formData.get("usage")],
      ["Message", formData.get("needs")],
    ];
    const body = fields
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");

    window.location.href = `mailto:sales@quantumadvisor.app?subject=${encodeURIComponent(
      `Quanfora ${String(formData.get("inquiryType") || "contact").toLowerCase()} inquiry`
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="contact-sales-page relative min-h-screen bg-[#050506] text-white">
      <IntroductionNav staticFull forceTheme="Deep Space" />

      <main className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl gap-12 px-6 pb-20 pt-28 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:pt-40">
        <section className="lg:sticky lg:top-36 lg:h-fit">
            <p className="text-sm font-medium text-white/38">Contact</p>
            <h1 className="mt-5 font-heading text-4xl font-normal tracking-normal text-white sm:text-5xl">
              Contact & Feedback
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/48">
              Send product feedback, report issues, ask questions, or reach out about sales and team workflows.
            </p>

          <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.055] p-5">
            <p className="text-sm leading-6 text-white/58">
              Want to try Quanfora before sending a note?
            </p>
            <Link
              href="/session"
              onClick={() => window.localStorage.setItem("financial-advisor.coverSeen", "true")}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.14] px-4 text-sm font-medium text-white/80 transition-colors hover:border-white/28 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Open Quanfora <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 text-sm text-white/46">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-green-positive" />
              Feedback from every user and team
            </div>
            <div className="flex items-center gap-3">
              <Sparkles className="size-4 text-cyan-secondary" />
              Sales, onboarding, and workflow guidance
            </div>
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-indigo-primary" />
              Direct reply from the Quanfora team
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="contact-sales-form grid gap-6" aria-label="Contact and feedback form">
          <label className="grid gap-2 text-sm font-medium text-white/42">
            Inquiry Type *
            <select name="inquiryType" required defaultValue="Feedback" className={inputClassName("appearance-none text-white/68")}>
              {["Feedback", "Support", "Bug report", "Feature request", "Sales"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-white/42">
              First Name *
              <input name="firstName" required autoComplete="given-name" className={inputClassName()} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-white/42">
              Last Name *
              <input name="lastName" required autoComplete="family-name" className={inputClassName()} />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-white/42">
              Email *
            <input name="email" type="email" required autoComplete="email" className={inputClassName()} />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-white/42">
              Phone Number
              <input name="phone" type="tel" autoComplete="tel" className={inputClassName()} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-white/42">
              Job Title
              <input name="jobTitle" autoComplete="organization-title" className={inputClassName()} />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-white/42">
              Company Name
              <input name="company" autoComplete="organization" className={inputClassName()} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-white/42">
              Company Website
              <input name="website" type="url" placeholder="https://acme.com" autoComplete="url" className={inputClassName()} />
            </label>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium text-white/42">
              What is this about? *
            </legend>
            <div className="grid gap-2">
              {PRODUCT_AREAS.map((area) => (
                <label
                  key={area}
                  className="contact-product-option flex h-11 items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.065] px-4 text-sm font-medium text-white/76 transition-colors hover:bg-white/[0.09]"
                >
                  <input
                    name="productAreas"
                    value={area}
                    type="checkbox"
                    className="size-4 rounded border-white/12 bg-black/30 accent-indigo-primary"
                  />
                  {area}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2 text-sm font-medium text-white/42">
              Company / Organization Headcount
              <select name="headcount" defaultValue="" className={inputClassName("appearance-none text-white/68")}>
              <option value="" disabled>
                Select size
              </option>
              {HEADCOUNT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-white/42">
            Number of Potential Users / Expected Usage Volume
            <input name="usage" placeholder="e.g. 25 users, 1M API calls/month" className={inputClassName()} />
          </label>

          <label className="grid gap-2 text-sm font-medium text-white/42">
            Message *
            <textarea
              name="needs"
              required
              rows={5}
              placeholder="Share feedback, a question, a bug report, or sales context"
              className={inputClassName("h-auto min-h-28 resize-y py-3 leading-6")}
            />
          </label>

          <button
            type="submit"
            className="intro-primary-action inline-flex h-11 w-fit items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Send message <CheckCircle2 className="size-4" />
          </button>
        </form>
      </main>

      <IntroductionFooter />
    </div>
  );
}
