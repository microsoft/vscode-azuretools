/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { GetTokenOptions, TokenCredential } from '@azure/core-auth';

/**
 * A single recorded timing span.
 */
export interface PerfSpan {
    /** Human-readable label for the operation */
    label: string;
    /** Absolute start time (ms since epoch) */
    startTime: number;
    /** Duration in milliseconds */
    durationMs: number;
    /** Optional parent span label for nesting */
    parent?: string;
    /** Optional metadata (e.g. tenant ID, account ID) */
    meta?: Record<string, string>;
}

/**
 * Collects and reports timing spans for subscription listing operations.
 */
export class PerfTracker {
    private spans: PerfSpan[] = [];

    /**
     * Time an async operation, recording a span when it completes.
     */
    async measure<T>(label: string, fn: () => Promise<T>, opts?: { parent?: string; meta?: Record<string, string> }): Promise<T> {
        const start = performance.now();
        try {
            return await fn();
        } finally {
            this.spans.push({
                label,
                startTime: start,
                durationMs: performance.now() - start,
                parent: opts?.parent,
                meta: opts?.meta,
            });
        }
    }

    /**
     * Record a span manually (for cases where `measure` is awkward).
     */
    record(label: string, startTime: number, durationMs: number, opts?: { parent?: string; meta?: Record<string, string> }): void {
        this.spans.push({ label, startTime, durationMs, parent: opts?.parent, meta: opts?.meta });
    }

    /**
     * Get all recorded spans, ordered by start time.
     */
    getSpans(): readonly PerfSpan[] {
        return [...this.spans].sort((a, b) => a.startTime - b.startTime);
    }

    /**
     * Reset all recorded spans.
     */
    reset(): void {
        this.spans = [];
    }

    /**
     * Returns a human-readable report of all spans, formatted as a table.
     *
     * Example output:
     * ```
     *  #  Duration   Label                                   Details
     *  1    142ms    getAccounts                             accounts: 2
     *  2     38ms    ├─ vscode.authentication.getAccounts
     *  3    312ms    getTenantsForAccount                    acct: u***r@e***.com
     *  4     15ms    ├─ getToken (tenant list)               tenant: undefined
     *  5    280ms    ├─ ARM tenants.list                     tenants: 3
     *  ...
     * ```
     */
    formatReport(): string {
        const spans = this.getSpans();
        if (spans.length === 0) {
            return '(no perf spans recorded)';
        }

        const lines: string[] = [];
        const header = ` ${'#'.padStart(3)}  ${'Duration'.padEnd(10)} ${'Label'.padEnd(45)} Details`;
        lines.push(header);
        lines.push('-'.repeat(header.length));

        for (let i = 0; i < spans.length; i++) {
            const s = spans[i];
            const idx = String(i + 1).padStart(3);
            const dur = `${Math.round(s.durationMs)}ms`.padEnd(10);
            const prefix = s.parent ? '├─ ' : '';
            const label = `${prefix}${s.label}`.padEnd(45);
            const details = s.meta ? Object.entries(s.meta).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
            lines.push(` ${idx}  ${dur} ${label} ${details}`);
        }

        return lines.join('\n');
    }

    /**
     * Returns a structured JSON-friendly summary grouped by phase.
     */
    getSummary(): Record<string, { totalMs: number; count: number; spans: PerfSpan[] }> {
        const groups = new Map<string, { totalMs: number; count: number; spans: PerfSpan[] }>();
        for (const span of this.spans) {
            const key = span.label;
            let group = groups.get(key);
            if (!group) {
                group = { totalMs: 0, count: 0, spans: [] };
                groups.set(key, group);
            }
            group.totalMs += span.durationMs;
            group.count++;
            group.spans.push(span);
        }
        return Object.fromEntries(groups);
    }
}

/**
 * Wraps a {@link TokenCredential} to record timing of every `getToken` call.
 * Inside the base provider, `credential.getToken` delegates to `getSessionFromVSCode`,
 * so this effectively times the VSCode token acquisition for each ARM SDK call.
 */
export function instrumentCredential(credential: TokenCredential, tracker: PerfTracker, contextLabel: string): TokenCredential {
    return {
        getToken: async (scopes: string | string[], options?: GetTokenOptions) => {
            const tenantId = options?.tenantId ?? '(default)';
            return tracker.measure(
                `getSessionFromVSCode (credential.getToken, ${contextLabel})`,
                () => credential.getToken(scopes, options),
                { parent: contextLabel, meta: { tenant: tenantId } },
            );
        },
    };
}
