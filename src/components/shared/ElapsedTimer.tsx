import { useEffect, useState } from 'react';

interface ElapsedTimerProps {
    /** Timestamp at which the tracked action started. If undefined the component renders nothing. */
    startedAt?: Date | string | null;
    /** Render prefix (e.g. "·") before the elapsed string. Default: none. */
    prefix?: string;
    /** Optional className for the wrapping span. */
    className?: string;
    /** Refresh interval in ms. Default 10s — enough to feel live without burning CPU. */
    intervalMs?: number;
}

function formatElapsed(startMs: number, nowMs: number): string {
    const diff = Math.max(0, nowMs - startMs);
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
    return `${s}s`;
}

/**
 * Renders the elapsed time since `startedAt`, updating live.
 * Use for "cleaning in progress", "call duration", etc. Hidden if no start.
 */
export function ElapsedTimer({ startedAt, prefix, className, intervalMs = 10_000 }: ElapsedTimerProps) {
    const startMs = startedAt ? new Date(startedAt).getTime() : null;
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!startMs) return;
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [startMs, intervalMs]);

    if (!startMs) return null;

    return (
        <span className={className}>
            {prefix ? `${prefix} ` : ''}{formatElapsed(startMs, now)}
        </span>
    );
}
