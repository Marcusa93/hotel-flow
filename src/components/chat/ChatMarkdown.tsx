import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface ChatMarkdownProps {
    content: string;
    isUser?: boolean;
}

/**
 * Renders markdown inside chat bubbles with compact, chat-optimized styles.
 * Uses @tailwindcss/typography prose classes with tight spacing overrides.
 * User messages render as plain text; assistant messages render as markdown.
 */
export function ChatMarkdown({ content, isUser = false }: ChatMarkdownProps) {
    // User messages: plain text, no markdown parsing needed
    if (isUser) {
        return <span className="whitespace-pre-wrap">{content}</span>;
    }

    return (
        <ReactMarkdown
            className={cn(
                'prose prose-sm dark:prose-invert max-w-none',
                // Tighten spacing for chat bubbles
                '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
                // Paragraphs
                'prose-p:my-1 prose-p:leading-relaxed',
                // Headings — compact
                'prose-h1:text-sm prose-h1:font-bold prose-h1:my-2',
                'prose-h2:text-sm prose-h2:font-bold prose-h2:my-2',
                'prose-h3:text-[13px] prose-h3:font-semibold prose-h3:my-1.5',
                'prose-h4:text-[13px] prose-h4:font-semibold prose-h4:my-1',
                // Lists — tight
                'prose-ul:my-1 prose-ul:pl-4',
                'prose-ol:my-1 prose-ol:pl-4',
                'prose-li:my-0.5 prose-li:leading-relaxed',
                // Bold — inherit color
                'prose-strong:text-inherit prose-strong:font-semibold',
                // Links
                'prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline',
                // Code inline
                'prose-code:text-xs prose-code:bg-black/5 dark:prose-code:bg-white/10 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none',
            )}
            components={{
                // Disable images (not useful inside chat)
                img: () => null,
                // Disable code blocks (not useful inside chat)
                pre: ({ children }) => <>{children}</>,
                // Disable tables (too wide for 380px chat)
                table: () => null,
                // Disable horizontal rules
                hr: () => <div className="my-2 border-t border-current/10" />,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
