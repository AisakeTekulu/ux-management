"use client";

/**
 * Markdown renderer for phase descriptions and notes.
 * Uses inline styling approach instead of @tailwindcss/typography plugin
 * to avoid webpack compatibility issues.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className = "" }: MarkdownProps) {
  if (!content || content.trim().length === 0) {
    return null;
  }

  return (
    <div className={`markdown-content text-sm text-text leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold text-text mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold text-text mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-text mt-3 mb-1">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-text mt-3 mb-1">{children}</h4>,
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-text">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-surface-subdued px-1.5 py-0.5 text-xs font-mono text-text">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="rounded-lg border border-border bg-surface-subdued p-3 mb-3 overflow-x-auto text-xs font-mono">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 italic text-text-subdued mb-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-subdued">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left text-xs font-semibold text-text-subdued">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2 text-text">{children}</td>
          ),
          input: ({ checked, ...props }) => (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mr-2 h-3.5 w-3.5 rounded border-border text-primary"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
