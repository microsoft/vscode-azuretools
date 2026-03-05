// @ts-check
const vscode = require('vscode');

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

/** @type {vscode.LogOutputChannel} */
let output;

function activate(context) {
    output = vscode.window.createOutputChannel('Azure Auth Perf', { log: true });
    context.subscriptions.push(output);

    output.info('Azure Auth Perf extension activated.');
    output.info('Run "Azure Auth Perf: Run Subscription Listing Profile" from the Command Palette.');
    output.show();

    context.subscriptions.push(
        vscode.commands.registerCommand('azureAuthPerf.runProfile', runProfile)
    );
}

async function runProfile() {
    // Dynamic import so the extension activates fast — the compiled TS
    // is in dist/esm/ relative to the auth package root.
    const { InstrumentedSubscriptionProvider } = await import(
        '../../../dist/esm/test/perf/InstrumentedSubscriptionProvider.js'
    );

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
    try {
        await provider.getAvailableSubscriptions({ noCache: true, filter: false });
    } catch (err) {
        output.warn(`Warm-up had an error (continuing anyway): ${err}`);
    }

    // ── Step 3: Profiled runs ────────────────────────────────────────
    const runs = 3;
    /** @type {number[]} */
    const e2eTimes = [];

    for (let i = 0; i < runs; i++) {
        output.info('');
        output.info(`═══════════════════════════════════════════════════════`);
        output.info(`  Run ${i + 1}/${runs} (cold, noCache)`);
        output.info(`═══════════════════════════════════════════════════════`);

        provider.tracker.reset();
        const start = performance.now();

        try {
            const subs = await provider.getAvailableSubscriptions({ noCache: true, filter: false });
            const elapsed = performance.now() - start;
            e2eTimes.push(elapsed);

            output.info(`Returned ${subs.length} subscriptions in ${Math.round(elapsed)}ms`);
        } catch (err) {
            const elapsed = performance.now() - start;
            e2eTimes.push(elapsed);
            output.error(`Failed after ${Math.round(elapsed)}ms: ${err}`);
        }

        // Print detailed report
        output.info('');
        output.info(provider.tracker.formatReport());

        // Print summary
        output.info('');
        const summary = provider.tracker.getSummary();
        for (const [phase, data] of Object.entries(summary)) {
            output.info(`  ${phase}: ${Math.round(data.totalMs)}ms total (${data.count} call(s))`);
        }
    }

    // ── Final summary ────────────────────────────────────────────────
    output.info('');
    output.info('═══════════════════════════════════════════════════════');
    output.info('  Variance Summary');
    output.info('═══════════════════════════════════════════════════════');
    output.info(`  Runs: ${e2eTimes.map(t => `${Math.round(t)}ms`).join(', ')}`);
    output.info(`  Min:  ${Math.round(Math.min(...e2eTimes))}ms`);
    output.info(`  Max:  ${Math.round(Math.max(...e2eTimes))}ms`);
    output.info(`  Avg:  ${Math.round(e2eTimes.reduce((a, b) => a + b, 0) / e2eTimes.length)}ms`);

    provider.dispose();

    vscode.window.showInformationMessage('Azure Auth Perf: Profiling complete — see output channel.');
}

function deactivate() { }

module.exports = { activate, deactivate };
