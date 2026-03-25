import { cn } from '@/lib/utils';

interface ChatMarkdownProps {
    content: string;
    isUser?: boolean;
}

/**
 * Lightweight markdown renderer for chat bubbles.
 * Supports: **bold**, *italic*, - lists, #### headings, and line breaks.
 * No external dependencies — just regex parsing.
 */
export function ChatMarkdown({ content, isUser = false }: ChatMarkdownProps) {
    if (isUser) {
        return <span className="whitespace-pre-wrap">{content}</span>;
    }

    return (
        <div className="space-y-1.5 text-sm leading-relaxed">
            {content.split('\n').map((line, i) => (
                <ChatLine key={i} line={line} />
            ))}
        </div>
    );
}

function ChatLine({ line }: { line: string }) {
    const trimmed = line.trim();

    // Empty line → small spacer
    if (!trimmed) return <div className="h-1" />;

    // Headings (#### → h4, ### → h3, etc.)
    if (trimmed.startsWith('####')) {
        return <p className="font-semibold text-[13px] mt-2 mb-0.5">{renderInline(trimmed.slice(4).trim())}</p>;
    }
    if (trimmed.startsWith('###')) {
        return <p className="font-semibold text-sm mt-2 mb-0.5">{renderInline(trimmed.slice(3).trim())}</p>;
    }
    if (trimmed.startsWith('##')) {
        return <p className="font-bold text-sm mt-2 mb-0.5">{renderInline(trimmed.slice(2).trim())}</p>;
    }

    // List items (- or *)
    if (/^[-*]\s/.test(trimmed)) {
        return (
            <div className="flex gap-1.5 pl-1">
                <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                <span>{renderInline(trimmed.slice(2).trim())}</span>
            </div>
        );
    }

    // Numbered list items (1. 2. etc.)
    const numMatch = trimmed.match(/^(\d+)\.\s/);
    if (numMatch) {
        return (
            <div className="flex gap-1.5 pl-1">
                <span className="text-muted-foreground shrink-0">{numMatch[1]}.</span>
                <span>{renderInline(trimmed.slice(numMatch[0].length).trim())}</span>
            </div>
        );
    }

    // Regular paragraph
    return <p>{renderInline(trimmed)}</p>;
}

/** Parse inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        // Bold: **text**
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        // Italic: *text* (but not **)
        const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
        // Code: `text`
        const codeMatch = remaining.match(/`(.+?)`/);

        // Find earliest match
        const matches = [
            boldMatch ? { type: 'bold', match: boldMatch } : null,
            italicMatch ? { type: 'italic', match: italicMatch } : null,
            codeMatch ? { type: 'code', match: codeMatch } : null,
        ].filter(Boolean) as { type: string; match: RegExpMatchArray }[];

        if (matches.length === 0) {
            parts.push(remaining);
            break;
        }

        // Pick the one that appears first
        const earliest = matches.sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0))[0];
        const idx = earliest.match.index ?? 0;

        // Text before match
        if (idx > 0) {
            parts.push(remaining.slice(0, idx));
        }

        // Render match
        const inner = earliest.match[1];
        if (earliest.type === 'bold') {
            parts.push(<strong key={key++} className="font-semibold">{inner}</strong>);
        } else if (earliest.type === 'italic') {
            parts.push(<em key={key++}>{inner}</em>);
        } else if (earliest.type === 'code') {
            parts.push(
                <code key={key++} className="text-xs bg-black/5 dark:bg-white/10 rounded px-1 py-0.5">
                    {inner}
                </code>
            );
        }

        remaining = remaining.slice(idx + earliest.match[0].length);
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}
