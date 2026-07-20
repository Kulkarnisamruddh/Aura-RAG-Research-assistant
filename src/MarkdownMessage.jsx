import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * Renders LLM assistant messages as formatted markdown with:
 * - GitHub-flavored markdown (tables, strikethrough, task lists)
 * - Syntax-highlighted code blocks
 * - Styled inline code, blockquotes, lists, and links
 */
export default function MarkdownMessage({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // --- Code blocks & inline code ---
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          // Block code (has language or is multiline)
          if (!inline && match) {
            return (
              <div style={{ position: 'relative', margin: '12px 0' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1e1e2e',
                  borderRadius: '10px 10px 0 0',
                  padding: '6px 14px',
                  fontSize: 11,
                  color: '#6b7280',
                  fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {match[1]}
                  <button
                    onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      color: '#9ca3af',
                      fontSize: 11,
                      padding: '2px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.12)'; e.target.style.color = '#e5e7eb'; }}
                    onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.06)'; e.target.style.color = '#9ca3af'; }}
                  >
                    Copy
                  </button>
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '0 0 10px 10px',
                    padding: '16px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    background: '#1e1e2e',
                  }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            );
          }

          // Block code without a language tag
          if (!inline) {
            return (
              <div style={{ margin: '12px 0' }}>
                <SyntaxHighlighter
                  style={oneDark}
                  language="text"
                  PreTag="div"
                  customStyle={{
                    borderRadius: 10,
                    padding: '16px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    background: '#1e1e2e',
                  }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            );
          }

          // Inline code
          return (
            <code
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                padding: '2px 7px',
                borderRadius: 5,
                fontSize: '0.88em',
                fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}
              {...props}
            >
              {children}
            </code>
          );
        },

        // --- Block quotes ---
        blockquote({ children }) {
          return (
            <blockquote style={{
              borderLeft: '3px solid #6366f1',
              margin: '12px 0',
              padding: '8px 16px',
              background: 'rgba(99, 102, 241, 0.06)',
              borderRadius: '0 8px 8px 0',
              color: '#c4c8d4',
              fontStyle: 'italic'
            }}>
              {children}
            </blockquote>
          );
        },

        // --- Tables ---
        table({ children }) {
          return (
            <div style={{ overflowX: 'auto', margin: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}>
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th style={{
              background: 'rgba(99, 102, 241, 0.1)',
              padding: '10px 14px',
              textAlign: 'left',
              fontWeight: 600,
              fontSize: 12,
              color: '#a5b4fc',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td style={{
              padding: '10px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              color: '#d1d5db'
            }}>
              {children}
            </td>
          );
        },

        // --- Lists ---
        ul({ children }) {
          return <ul style={{ paddingLeft: 20, margin: '8px 0', lineHeight: 1.8 }}>{children}</ul>;
        },
        ol({ children }) {
          return <ol style={{ paddingLeft: 20, margin: '8px 0', lineHeight: 1.8 }}>{children}</ol>;
        },
        li({ children }) {
          return <li style={{ marginBottom: 4, color: '#d1d5db' }}>{children}</li>;
        },

        // --- Links ---
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#818cf8',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(129, 140, 248, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.target.style.borderBottomColor = '#818cf8'}
              onMouseLeave={e => e.target.style.borderBottomColor = 'rgba(129, 140, 248, 0.3)'}
            >
              {children}
            </a>
          );
        },

        // --- Headings ---
        h1({ children }) {
          return <h1 style={{ fontSize: 20, fontWeight: 700, margin: '16px 0 8px', color: '#f3f4f6', letterSpacing: '-0.5px' }}>{children}</h1>;
        },
        h2({ children }) {
          return <h2 style={{ fontSize: 17, fontWeight: 600, margin: '14px 0 6px', color: '#e5e7eb', letterSpacing: '-0.3px' }}>{children}</h2>;
        },
        h3({ children }) {
          return <h3 style={{ fontSize: 15, fontWeight: 600, margin: '12px 0 4px', color: '#d1d5db' }}>{children}</h3>;
        },

        // --- Horizontal rule ---
        hr() {
          return <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0' }} />;
        },

        // --- Paragraphs ---
        p({ children }) {
          return <p style={{ margin: '6px 0', lineHeight: 1.7 }}>{children}</p>;
        },

        // --- Bold & italic ---
        strong({ children }) {
          return <strong style={{ color: '#f3f4f6', fontWeight: 600 }}>{children}</strong>;
        },
        em({ children }) {
          return <em style={{ color: '#c4c8d4' }}>{children}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
