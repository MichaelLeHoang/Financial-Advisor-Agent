"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type React from "react";

function textFromChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(textFromChildren).join("");
  return "";
}

function highlightClass(text: string) {
  const normalized = text.toLowerCase();
  if (/\b(buy|bullish|upside|support|outperform)\b/i.test(text)) {
    return "text-emerald-200 bg-emerald-400/10 ring-emerald-300/20";
  }
  if (/\b(sell|bearish|downside|resistance|downgrade)\b/i.test(text)) {
    return "text-rose-200 bg-rose-400/10 ring-rose-300/20";
  }
  if (/\b(hold|neutral|balanced|watch)\b/i.test(text)) {
    return "text-sky-200 bg-sky-400/10 ring-sky-300/20";
  }
  if (normalized.includes("risk") || normalized.includes("warning") || normalized.includes("limitation") || normalized.includes("source gap")) {
    return "text-amber-200 bg-amber-400/10 ring-amber-300/20";
  }
  if (normalized.includes("confidence") || normalized.includes("evidence") || normalized.includes("source")) {
    return "text-indigo-100 bg-indigo-primary/12 ring-indigo-primary/25";
  }
  return "text-[var(--text-primary)] bg-[var(--surface-card-hover)] ring-[var(--theme-border)]";
}

function HighlightValue({ children }: { children: React.ReactNode }) {
  const text = textFromChildren(children);
  return (
    <strong className={`rounded-md px-1.5 py-0.5 font-semibold ring-1 ${highlightClass(text)}`}>
      {children}
    </strong>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-xl font-bold text-indigo-primary first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-lg font-semibold text-indigo-primary first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-semibold text-indigo-primary first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  strong: ({ children }) => <HighlightValue>{children}</HighlightValue>,
  em: ({ children }) => <em className="text-[var(--text-secondary)]">{children}</em>,
  ul: ({ children }) => <ul className="mb-3 ml-5 list-none space-y-1.5 last:mb-0 [&_ul]:mb-0 [&_ul]:mt-1.5 [&_ul]:ml-5">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1.5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="relative pl-5 leading-relaxed before:absolute before:left-0 before:top-[0.65em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-indigo-primary/60">
      {children}
    </li>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-primary underline decoration-indigo-primary/30 underline-offset-2 transition-colors hover:text-indigo-primary/80 hover:decoration-indigo-primary/60"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-indigo-primary/40 pl-4 text-[var(--text-muted)] italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded-md bg-[var(--surface-card-hover)] px-1.5 py-0.5 text-[13px] text-indigo-primary/90">
          {children}
        </code>
      );
    }
    return (
      <code className={className}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-[var(--surface-card)] border border-[var(--theme-border)] p-4 text-[13px] leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-[var(--theme-border)]">
      <table className="w-full table-fixed text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-[var(--theme-border)] bg-[var(--surface-card-hover)] text-left text-[var(--text-secondary)]">
      {children}
    </thead>
  ),
  th: ({ children }) => <th className="max-w-[18rem] break-words px-3 py-2 align-top font-medium text-[var(--text-primary)] [overflow-wrap:anywhere]">{children}</th>,
  td: ({ children }) => {
    const text = textFromChildren(children);
    const shouldHighlight = /\b(buy|sell|hold|bullish|bearish|neutral|risk|support|resistance|confidence|source|unavailable|limited)\b/i.test(text);
    return (
      <td className="max-w-[18rem] break-words px-3 py-2 align-top text-[var(--text-secondary)] [overflow-wrap:anywhere]">
        {shouldHighlight ? <span className={`break-words rounded-md px-1.5 py-0.5 ring-1 [overflow-wrap:anywhere] ${highlightClass(text)}`}>{children}</span> : children}
      </td>
    );
  },
  hr: () => <hr className="my-4 border-[var(--theme-border)]" />,
};

interface MarkdownProps {
  content: string;
  className?: string;
}

export default function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
