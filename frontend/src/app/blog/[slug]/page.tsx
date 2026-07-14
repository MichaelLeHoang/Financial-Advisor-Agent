"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Calendar, ChevronRight, Clock, User } from "lucide-react";
import { IntroductionNav, IntroductionFooter } from "@/app/introduction/components";
import { getBlogPost, getRelatedPosts } from "../data";

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const post = getBlogPost(slug);
  const related = getRelatedPosts(slug, 3);

  if (!post) {
    return (
      <main className="min-h-screen bg-[#050507] text-white">
        <IntroductionNav />
        <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 pt-32">
          <h1 className="text-2xl font-bold">Article not found</h1>
          <p className="mt-2 text-white/40">The article you're looking for doesn't exist.</p>
          <Link
            href="/blog"
            className="theme-accent-surface on-accent mt-6 inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-medium"
          >
            <ArrowLeft className="size-4" />
            Back to blog
          </Link>
        </section>
        <IntroductionFooter />
      </main>
    );
  }

  const [activeId, setActiveId] = useState<string>("");

  // Parse markdown-like content into simple HTML
  const headings: { id: string; text: string }[] = [];
  const contentHtml = post.content
    .split("\n")
    .map((line) => {
      if (line.startsWith("## ")) {
        const text = line.slice(3);
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        headings.push({ id, text });
        return `<h2 id="${id}" class="mt-10 mb-4 text-xl font-bold text-white/90 sm:text-2xl scroll-mt-32">${text}</h2>`;
      }
      if (line.startsWith("### ")) {
        return `<h3 class="mt-8 mb-3 text-lg font-semibold text-white/85">${line.slice(4)}</h3>`;
      }
      if (line.startsWith("- ")) {
        return `<li class="ml-5 mb-1.5 text-[15px] leading-relaxed text-white/55 list-disc">${formatInline(line.slice(2))}</li>`;
      }
      if (line.match(/^\d+\.\s/)) {
        return `<li class="ml-5 mb-1.5 text-[15px] leading-relaxed text-white/55 list-decimal">${formatInline(line.replace(/^\d+\.\s/, ""))}</li>`;
      }
      if (line.trim() === "") {
        return "<br/>";
      }
      return `<p class="mb-3 text-[15px] leading-relaxed text-white/55">${formatInline(line)}</p>`;
    })
    .join("\n");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-10% 0px -80% 0px" }
    );
    
    const elements = document.querySelectorAll("article h2[id]");
    elements.forEach((el) => observer.observe(el));

    // Fallback if we don't have an active ID initially, set to first
    if (headings.length > 0 && !activeId) {
      setActiveId(headings[0].id);
    }

    return () => observer.disconnect();
  }, [headings, activeId]);

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <IntroductionNav />

      <div className="mx-auto flex max-w-[1300px] justify-center gap-12 xl:gap-24 px-6 pb-20 pt-28 sm:pt-32">
        <article className="w-full max-w-3xl shrink-0">
          {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button
            type="button"
            onClick={() => router.push("/blog")}
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/35 transition-colors hover:text-white/60"
          >
            <ArrowLeft className="size-3.5" />
            Back to blog
          </button>
        </motion.div>

        {/* Hero gradient */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className={`relative mb-8 h-48 w-full overflow-hidden rounded-3xl bg-gradient-to-br ${post.heroGradient} sm:h-64`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050507]/60 to-transparent" />
          <div className="absolute right-8 top-8 size-20 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm sm:size-28" />
          <div className="absolute right-20 top-20 size-14 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm sm:right-28 sm:top-24 sm:size-20" />
        </motion.div>

        {/* Article header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-300">
              {post.category}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/30">
              <Calendar className="size-3" />
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/30">
              <Clock className="size-3" />
              {post.readTime} read
            </span>
          </div>

          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white/95 sm:text-3xl lg:text-4xl">
            {post.title}
          </h1>

          <div className="mt-4 flex items-center gap-3 border-b border-white/[0.06] pb-8">
            <div className="flex size-8 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
              <User className="size-3.5" />
            </div>
            <span className="text-sm text-white/50">{post.author}</span>
          </div>
        </motion.div>

        {/* Article body */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-14 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 text-center sm:p-8"
        >
          <h3 className="text-lg font-bold text-white/90">Try Quanfora</h3>
          <p className="mt-2 text-sm text-white/40">
            Experience the features discussed in this article. Start your free research session today.
          </p>
          <Link
            href="/"
            className="theme-accent-surface on-accent mt-5 inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold"
          >
            Get started
            <ChevronRight className="size-4" />
          </Link>
        </motion.div>

        {/* Related Articles */}
        {related.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="mt-16"
          >
            <h2 className="mb-6 text-lg font-bold text-white/80">Related articles</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <div className={`relative h-24 w-full bg-gradient-to-br ${r.heroGradient}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050507]/50 to-transparent" />
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] font-medium text-white/30">{r.category}</span>
                    <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-white/80 transition-colors group-hover:text-white">
                      {r.title}
                    </h4>
                    <span className="mt-2 flex items-center gap-1 text-[10px] text-white/25">
                      <Clock className="size-2.5" />
                      {r.readTime}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
        </article>

        {/* Table of Contents - Right Sidebar */}
        {headings.length > 0 && (
          <aside className="hidden xl:block w-[280px] shrink-0">
            <div className="sticky top-32 flex flex-col gap-2 border-l border-white/10 pl-5">
              {headings.map((h, i) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
                    window.history.pushState(null, "", `#${h.id}`);
                  }}
                  className={`relative text-[13px] leading-relaxed transition-colors ${
                    activeId === h.id ? "text-white" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {/* Active indicator line */}
                  {activeId === h.id && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute -left-[21px] top-0 bottom-0 w-[2px] bg-white"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  {i + 1}. {h.text}
                </a>
              ))}
            </div>
          </aside>
        )}
      </div>

      <IntroductionFooter />
    </main>
  );
}

/** Convert **bold** and `code` markers to HTML spans */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/75 font-semibold">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-white/[0.06] px-1.5 py-0.5 text-[13px] font-mono text-indigo-300/80">$1</code>');
}
