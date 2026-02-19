"use client";

/**
 * ChatMessage — Rich message rendering component.
 *
 * Renders assistant messages as markdown with:
 *   - Syntax-highlighted code blocks with copy button
 *   - Tables, lists, blockquotes
 *   - Inline code, bold, italic
 *   - Copy-to-clipboard for full message
 *
 * User messages rendered as plain styled text.
 * System messages rendered as minimal centered banners.
 */

import { useState, useCallback, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  model?: string;
  tokensUsed?: number;
  duration?: number;
}

interface ChatMessageProps {
  message: ChatMessageData;
  isLatest?: boolean;
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1 rounded-md transition-all duration-200",
        size === "sm"
          ? "px-2 py-1 text-[11px]"
          : "px-1.5 py-0.5 text-[10px]",
        copied
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-700/80"
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ─── Code Block with Copy ──────────────────────────────────────────────────────

function CodeBlock({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code = typeof children === "string" ? children : String(children || "").replace(/\n$/, "");

  // Inline code (no language class)
  if (!className) {
    return (
      <code
        className="px-1.5 py-0.5 rounded-md bg-slate-800 text-orange-300 text-[13px] font-mono border border-slate-700/50"
        {...props}
      >
        {children}
      </code>
    );
  }

  // Block code with copy button
  return (
    <div className="relative group/code my-3 rounded-xl overflow-hidden border border-slate-700/50">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/50">
        <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">
          {language || "code"}
        </span>
        <CopyButton text={code} size="xs" />
      </div>
      {/* Code content */}
      <div className="overflow-x-auto">
        <code className={cn(className, "block p-4 text-[13px] leading-relaxed")} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Markdown Components Config ──────────────────────────────────────────────

const markdownComponents = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code: CodeBlock as any,
  // Tables
  table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-slate-700/50">
      <table className="w-full text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-slate-800/50 text-slate-300" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="px-3 py-2 text-left text-xs font-semibold border-b border-slate-700/50" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-3 py-2 text-sm border-b border-slate-800/50" {...props}>{children}</td>
  ),
  // Lists
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-2 ml-4 space-y-1 list-disc marker:text-slate-500" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-2 ml-4 space-y-1 list-decimal marker:text-slate-500" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="text-sm leading-relaxed pl-1" {...props}>{children}</li>
  ),
  // Blockquotes
  blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-3 pl-4 border-l-2 border-orange-500/50 text-slate-300 italic bg-slate-800/30 rounded-r-lg py-2 pr-3"
      {...props}
    >
      {children}
    </blockquote>
  ),
  // Headings
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-lg font-bold text-white mt-4 mb-2 pb-1 border-b border-slate-700/50" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-base font-bold text-white mt-3 mb-1.5" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-sm font-bold text-white mt-3 mb-1" {...props}>{children}</h3>
  ),
  // Paragraphs
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-sm leading-relaxed mb-2 last:mb-0" {...props}>{children}</p>
  ),
  // Links
  a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-orange-400 hover:text-orange-300 underline underline-offset-2 decoration-orange-500/30 transition-colors"
      {...props}
    >
      {children}
    </a>
  ),
  // Horizontal rule
  hr: () => <hr className="my-4 border-slate-700/50" />,
  // Strong / emphasis
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-white" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic text-slate-300" {...props}>{children}</em>
  ),
};

// ─── Assistant Message ───────────────────────────────────────────────────────

function AssistantMessage({ message }: { message: ChatMessageData }) {
  const modelShort = message.model?.split("/").pop() || "";

  return (
    <div className="flex gap-3 max-w-full">
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-sm shadow-lg shadow-emerald-500/10">
          🌱
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Name + model */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-emerald-400">Groot</span>
          {modelShort && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700/50 font-mono">
              {modelShort}
            </span>
          )}
        </div>

        {/* Markdown body */}
        <div className="prose-chat text-slate-200">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            rehypePlugins={[rehypeHighlight]}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Footer: time + tokens + duration + copy */}
        <div className="flex items-center gap-3 mt-2 pt-1.5">
          <span className="text-[10px] text-slate-600">{formatTime(message.timestamp)}</span>
          {message.tokensUsed ? (
            <span className="text-[10px] text-slate-600 flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {formatTokens(message.tokensUsed)} tokens
            </span>
          ) : null}
          {message.duration ? (
            <span className="text-[10px] text-slate-600 flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(message.duration)}
            </span>
          ) : null}
          <div className="ml-auto">
            <CopyButton text={message.content} size="xs" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── User Message ────────────────────────────────────────────────────────────

function UserMessage({ message }: { message: ChatMessageData }) {
  return (
    <div className="flex gap-3 justify-end">
      <div className="max-w-[75%]">
        <div className="bg-orange-600 text-white rounded-2xl rounded-br-md px-4 py-3 shadow-lg shadow-orange-600/10">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="flex justify-end mt-1">
          <span className="text-[10px] text-slate-600">{formatTime(message.timestamp)}</span>
        </div>
      </div>

      {/* User avatar */}
      <div className="flex-shrink-0 mt-1">
        <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center text-sm shadow-lg shadow-slate-500/10">
          <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── System Message ──────────────────────────────────────────────────────────

function SystemMessage({ message }: { message: ChatMessageData }) {
  // Detect message types for different styling
  const isWelcome = message.id === "welcome";
  const isError = message.content.toLowerCase().startsWith("error:");
  const isAction = message.content.includes("🤖");
  const isCancelled = message.content.includes("cancelled");

  return (
    <div className="flex justify-center px-4">
      <div
        className={cn(
          "max-w-lg rounded-xl px-4 py-2.5 text-center transition-all",
          isWelcome
            ? "bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 text-emerald-300"
            : isError
              ? "bg-red-500/10 border border-red-500/20 text-red-300"
              : isAction
                ? "bg-blue-500/10 border border-blue-500/20 text-blue-300"
                : isCancelled
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                  : "bg-slate-800/40 border border-slate-700/30 text-slate-400"
        )}
      >
        <p className="text-xs leading-relaxed">{message.content}</p>
        <span className="text-[10px] opacity-50 mt-1 block">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export const ChatMessage = memo(function ChatMessage({ message, isLatest }: ChatMessageProps) {
  switch (message.role) {
    case "assistant":
      return (
        <div className={cn("animate-in fade-in slide-in-from-left-2 duration-300", isLatest && "")}>
          <AssistantMessage message={message} />
        </div>
      );
    case "user":
      return (
        <div className="animate-in fade-in slide-in-from-right-2 duration-300">
          <UserMessage message={message} />
        </div>
      );
    case "system":
      return (
        <div className="animate-in fade-in duration-300">
          <SystemMessage message={message} />
        </div>
      );
    default:
      return null;
  }
});
