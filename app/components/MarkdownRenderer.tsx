import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus'
import { colors, typography, radius } from '../constants/design'
import clsx from 'clsx'
import type { Components } from 'react-markdown'

interface MarkdownRendererProps {
  content: string
  className?: string
}

const components: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className={clsx(
      'text-2xl font-bold',
      colors.text.primary,
      'mt-6 mb-4 first:mt-0'
    )}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className={clsx(
      'text-xl font-semibold',
      colors.text.primary,
      'mt-5 mb-3'
    )}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className={clsx(
      'text-lg font-semibold',
      colors.text.primary,
      'mt-4 mb-2'
    )}>
      {children}
    </h3>
  ),
  
  // Paragraphs
  p: ({ children }) => (
    <p className={clsx(
      typography.font.mono,
      typography.size.sm,
      colors.text.primary,
      'mb-3 last:mb-0',
      'leading-relaxed'
    )}>
      {children}
    </p>
  ),
  
  // Lists
  ul: ({ children }) => (
    <ul className={clsx(
      'list-disc list-inside',
      typography.font.mono,
      typography.size.sm,
      colors.text.primary,
      'mb-3 pl-2'
    )}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className={clsx(
      'list-decimal list-inside',
      typography.font.mono,
      typography.size.sm,
      colors.text.primary,
      'mb-3 pl-2'
    )}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="mb-1 [&>p]:inline [&>ul]:mt-1 [&>ol]:mt-1">{children}</li>
  ),
  
  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className={clsx(
      'border-l-4 border-zinc-700',
      'pl-4 py-1 my-3',
      colors.text.secondary,
      typography.font.mono,
      typography.size.sm,
      'italic'
    )}>
      {children}
    </blockquote>
  ),
  
  // Code
  code: (props) => {
    const { className, children } = props as { className?: string; children?: React.ReactNode }
    const inline = !className?.startsWith('language-')
    const match = /language-(\w+)/.exec(className || '')
    const language = match ? match[1] : ''
    
    if (!inline && language) {
      return (
        <div className="my-3 [&_pre]:!font-mono [&_code]:!font-mono [&_code]:!text-[0.875rem]">
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: '0.5rem',
              fontSize: '0.9375rem', // 15px to get closer to 14px target
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.02)', // very subtle white frost on black
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      )
    }
    
    return (
      <code className={clsx(
        'px-1.5 py-0.5',
        colors.background.tertiary,
        colors.text.secondary,
        radius.sm,
        typography.font.mono
      )}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => {
    // Check if the child is a code element with language
    const codeElement = children as React.ReactElement<{ className?: string }>
    if (codeElement?.props?.className?.includes('language-')) {
      // Let the code component handle it
      return <>{children}</>
    }
    
    // Otherwise, render as a simple pre block
    return (
      <pre className={clsx(
        'my-3 p-3',
        colors.background.secondary,
        radius.md,
        'overflow-x-auto',
        typography.font.mono,
        typography.size.sm
      )}>
        {children}
      </pre>
    )
  },
  
  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        colors.accent.blue.text,
        'hover:underline',
        'transition-colors'
      )}
    >
      {children}
    </a>
  ),
  
  // Emphasis
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  
  // Horizontal rule
  hr: () => (
    <hr className={clsx(
      'my-4',
      colors.border.subtle,
      'border-t'
    )} />
  ),
  
  // Tables (from GFM)
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className={clsx(
        'min-w-full',
        typography.size.sm
      )}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className={clsx(
      colors.border.subtle,
      'border-b'
    )}>
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody>{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className={clsx(
      colors.border.subtle,
      'border-b last:border-0'
    )}>
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className={clsx(
      'text-left px-3 py-2',
      colors.text.primary,
      'font-semibold'
    )}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className={clsx(
      'px-3 py-2',
      colors.text.secondary
    )}>
      {children}
    </td>
  ),
  
  // Task lists (from GFM)
  input: ({ type, checked, disabled }) => {
    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className={clsx(
            'mr-2',
            'cursor-not-allowed'
          )}
          readOnly
        />
      )
    }
    return null
  }
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={clsx(typography.font.mono, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}