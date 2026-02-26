/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { InstrumentedSubscriptionProvider } from '../InstrumentedSubscriptionProvider';
import type { GetSessionTiming } from '../../../src/utils/getSessionFromVSCode';

/**
 * Minimal extension for profiling Azure subscription listing performance.
 *
 * Usage:
 *   1. F5 to launch (uses "Run Perf Profiler" launch config)
 *   2. Wait for VS Code to fully start up
 *   3. Sign in to Azure if prompted
 *   4. Command Palette → "Azure Auth Perf: Run Subscription Listing Profile"
 *   5. Results appear in the "Azure Auth Perf" output channel
 */

let output: vscode.LogOutputChannel;

export function activate(context: vscode.ExtensionContext): void {
    output = vscode.window.createOutputChannel('Azure Auth Perf', { log: true });
    context.subscriptions.push(output);

    output.info('Azure Auth Perf extension activated.');
    output.info('Run "Azure Auth Perf: Run Subscription Listing Profile" from the Command Palette.');
    output.show();

    context.subscriptions.push(
        vscode.commands.registerCommand('azureAuthPerf.runProfile', runProfile)
    );
}

async function runProfile(): Promise<void> {
    // Dynamic imports to avoid blocking activation with heavy module loading
    const { InstrumentedSubscriptionProvider } = await import('../InstrumentedSubscriptionProvider');
    const { getSessionFromVSCodeTimings } = await import('../../../src/utils/getSessionFromVSCode');

    const provider = new InstrumentedSubscriptionProvider(output);

    // ── Step 1: Sign in ──────────────────────────────────────────────
    output.info('');
    output.info('═══════════════════════════════════════════════════════');
    output.info('  Signing in...');
    output.info('═══════════════════════════════════════════════════════');
    try {
        const signedIn = await provider.signIn();
        if (!signedIn) {
            output.error('Sign-in returned false — cannot profile.');
            vscode.window.showErrorMessage('Azure Auth Perf: Not signed in.');
            provider.dispose();
            return;
        }
        output.info('Signed in successfully.');
    } catch (err) {
        output.error(`Sign-in failed: ${err}`);
        vscode.window.showErrorMessage(`Azure Auth Perf: Sign-in failed — ${err}`);
        provider.dispose();
        return;
    }

    // ── Step 2: Warm-up run (ignore timings) ─────────────────────────
    output.info('');
    output.info('Warm-up run (timings discarded)...');
    getSessionFromVSCodeTimings.length = 0;
    try {
        await provider.getAvailableSubscriptions({ noCache: true, filter: false });
    } catch (err) {
        output.warn(`Warm-up had an error (continuing anyway): ${err}`);
    }

    // ── Step 3: Cold profiled runs (noCache) ────────────────────────
    const coldRuns = 5;
    const coldTimes: number[] = [];

    for (let i = 0; i < coldRuns; i++) {
        output.info('');
        output.info(`═══════════════════════════════════════════════════════`);
        output.info(`  Cold Run ${i + 1}/${coldRuns} (noCache)`);
        output.info(`═══════════════════════════════════════════════════════`);

        provider.tracker.reset();
        getSessionFromVSCodeTimings.length = 0;
        const start = performance.now();

        try {
            const subs = await provider.getAvailableSubscriptions({ noCache: true, filter: false });
            const elapsed = performance.now() - start;
            coldTimes.push(elapsed);

            output.info(`Returned ${subs.length} subscriptions in ${Math.round(elapsed)}ms`);
        } catch (err) {
            const elapsed = performance.now() - start;
            coldTimes.push(elapsed);
            output.error(`Failed after ${Math.round(elapsed)}ms: ${err}`);
        }

        printRunReport(provider, getSessionFromVSCodeTimings);
    }

    // ── Step 4: Warm profiled runs (cached) ──────────────────────────
    const warmRuns = 5;
    const warmTimes: number[] = [];

    for (let i = 0; i < warmRuns; i++) {
        output.info('');
        output.info(`═══════════════════════════════════════════════════════`);
        output.info(`  Warm Run ${i + 1}/${warmRuns} (cached)`);
        output.info(`═══════════════════════════════════════════════════════`);

        provider.tracker.reset();
        getSessionFromVSCodeTimings.length = 0;
        const start = performance.now();

        try {
            const subs = await provider.getAvailableSubscriptions({ filter: false });
            const elapsed = performance.now() - start;
            warmTimes.push(elapsed);

            output.info(`Returned ${subs.length} subscriptions in ${Math.round(elapsed)}ms`);
        } catch (err) {
            const elapsed = performance.now() - start;
            warmTimes.push(elapsed);
            output.error(`Failed after ${Math.round(elapsed)}ms: ${err}`);
        }

        printRunReport(provider, getSessionFromVSCodeTimings);
    }

    // ── Final summary ────────────────────────────────────────────────
    output.info('');
    output.info('═══════════════════════════════════════════════════════');
    output.info('  Cold Runs Variance Summary');
    output.info('═══════════════════════════════════════════════════════');
    printVarianceSummary(coldTimes);

    output.info('');
    output.info('═══════════════════════════════════════════════════════');
    output.info('  Warm Runs (Cached) Variance Summary');
    output.info('═══════════════════════════════════════════════════════');
    printVarianceSummary(warmTimes);

    provider.dispose();

    vscode.window.showInformationMessage('Azure Auth Perf: Profiling complete — see output channel.');
}

function printRunReport(provider: InstrumentedSubscriptionProvider, timings: GetSessionTiming[]): void {
    // Print detailed report
    output.info('');
    output.info(provider.tracker.formatReport());

    // Print summary
    output.info('');
    const summary = provider.tracker.getSummary();
    for (const [phase, data] of Object.entries(summary)) {
        output.info(`  ${phase}: ${Math.round(data.totalMs)}ms total (${data.count} call(s))`);
    }

    // Print vscode.authentication.getSession timings
    output.info('');
    output.info('  ── vscode.authentication.getSession calls ──');
    for (const t of timings) {
        const tenant = t.tenantId ? t.tenantId.substring(0, 8) + '…' : '(default)';
        const mode = t.createIfNone ? 'createIfNone' : t.silent ? 'silent' : 'default';
        output.info(`    ${Math.round(t.elapsed)}ms  tenant=${tenant}  mode=${mode}`);
    }
    output.info(`  Total getSession calls: ${timings.length}, total time: ${Math.round(timings.reduce((a, b) => a + b.elapsed, 0))}ms`);
}

function printVarianceSummary(times: number[]): void {
    output.info(`  Runs: ${times.map(t => `${Math.round(t)}ms`).join(', ')}`);
    output.info(`  Min:  ${Math.round(Math.min(...times))}ms`);
    output.info(`  Max:  ${Math.round(Math.max(...times))}ms`);
    output.info(`  Avg:  ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}ms`);
}

export function deactivate(): void { }
