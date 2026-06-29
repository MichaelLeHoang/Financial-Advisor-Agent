"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

import { Separator } from "@/components/ui/separator";

const testimonials = [
  {
    quote: "Quanfora helps me turn a market question into a documented decision instead of another scattered note.",
    name: "Maya Chen",
    role: "Active investor",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&auto=format&fit=crop&q=80",
  },
  {
    quote: "The best part is the discipline. Research, risk, and follow-up all stay in one workflow.",
    name: "Marcus Lee",
    role: "Portfolio builder",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&auto=format&fit=crop&q=80",
  },
  {
    quote: "It gives my watchlist context before I trade, which is exactly where most tools fall short.",
    name: "Elena Voss",
    role: "Independent trader",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=900&auto=format&fit=crop&q=80",
  },
];

export function TestimonialsMinimal() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % testimonials.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <motion.section
      className="landing-testimonials relative z-10 px-6 py-16 sm:py-20"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <Separator className="mx-auto mb-14 max-w-5xl" />
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-12 min-h-[132px] sm:min-h-[112px]">
          {testimonials.map((testimonial, index) => (
            <p
              key={testimonial.name}
              className={`
                absolute inset-0 text-xl font-light leading-relaxed text-white md:text-2xl
                transition-all duration-500 ease-out
                ${
                  active === index
                    ? "translate-y-0 opacity-100 blur-0"
                    : "pointer-events-none translate-y-4 opacity-0 blur-sm"
                }
              `}
            >
              &quot;{testimonial.quote}&quot;
            </p>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex -space-x-2">
            {testimonials.map((testimonial, index) => (
              <button
                key={testimonial.name}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show testimonial from ${testimonial.name}`}
                className={`
                  relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-[var(--background)]
                  transition-all duration-300 ease-out
                  ${active === index ? "z-10 scale-110" : "grayscale hover:scale-105 hover:grayscale-0"}
                `}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={testimonial.image} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-white/[0.08]" />

          <div className="relative min-h-[44px] flex-1">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.name}
                className={`
                  absolute inset-0 flex flex-col justify-center
                  transition-all duration-400 ease-out
                  ${active === index ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"}
                `}
              >
                <span className="text-sm font-medium text-white">{testimonial.name}</span>
                <span className="text-xs text-white/42">{testimonial.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Separator className="mx-auto mt-14 max-w-5xl" />
    </motion.section>
  );
}
