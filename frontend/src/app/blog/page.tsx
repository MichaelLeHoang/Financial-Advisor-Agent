"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, Calendar, Clock, ChevronRight } from "lucide-react";
import { IntroductionNav, IntroductionFooter } from "@/app/introduction/components";
import { blogPosts, BLOG_CATEGORIES } from "./data";

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All"
      ? blogPosts
      : blogPosts.filter((p) => p.category === activeCategory);

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <IntroductionNav />

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-28 sm:pt-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-[0_0_24px_rgba(99,102,241,0.25)]">
              <BookOpen className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Blog</h1>
              <p className="text-sm text-white/40">Insights for traders building with AI</p>
            </div>
          </div>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-10 flex flex-wrap gap-2"
        >
          {BLOG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                activeCategory === cat
                  ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300 shadow-[0_0_16px_rgba(99,102,241,0.1)]"
                  : "border-white/[0.06] bg-white/[0.03] text-white/50 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Article Feed */}
        {filtered.length > 0 ? (
          <div className="flex flex-col gap-10">
            {filtered.map((post, i) => (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.05 }}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block overflow-hidden rounded-3xl border border-white/[0.06] transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_0_64px_rgba(99,102,241,0.08)]"
                >
                  {/* Hero gradient card */}
                  <div className={`relative h-56 w-full overflow-hidden bg-gradient-to-br ${post.heroGradient} sm:h-72`}>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050507]/80 to-transparent" />

                    {/* Floating decorative elements */}
                    <div className="absolute right-8 top-8 size-20 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm sm:size-28 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105" />
                    <div className="absolute right-20 top-20 size-14 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm sm:right-28 sm:top-24 sm:size-20 transition-transform duration-500 delay-75 group-hover:-rotate-3 group-hover:scale-110" />
                  </div>

                  <div className="bg-white/[0.025] px-6 py-6 sm:px-8 sm:py-8">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300">
                        {post.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-white/30">
                        <Calendar className="size-3" />
                        {new Date(post.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold leading-tight text-white/90 transition-colors group-hover:text-white sm:text-2xl">
                      {post.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/40 sm:text-base">
                      {post.excerpt}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-xs text-white/30">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {post.readTime} read
                      </span>
                      <span>{post.author}</span>
                      <span className="ml-auto flex items-center gap-1 text-indigo-400/60 transition-colors group-hover:text-indigo-400">
                        Read article
                        <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-20">
            <BookOpen className="size-10 text-white/15" />
            <p className="text-sm text-white/35">No articles in this category yet.</p>
          </div>
        )}
      </section>

      <IntroductionFooter />
    </main>
  );
}
