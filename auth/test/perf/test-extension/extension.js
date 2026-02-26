// @ts-check
const vscode = require('vscode');
// Use require() — NOT dynamic import() — so the debugger can resolve sourcemaps
// at module load time. This is critical for breakpoint binding.
const { InstrumentedSubscriptionProvider } = require('../../../dist/test/perf/InstrumentedSubscriptionProvider');
const { getSessionFromVSCodeTimings } = require('../../../dist/src/utils/getSessionFromVSCode');

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
    /** @type {number[]} */
    const coldTimes = [];

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
        for (const t of getSessionFromVSCodeTimings) {
            const tenant = t.tenantId ? t.tenantId.substring(0, 8) + '…' : '(default)';
            const mode = t.createIfNone ? 'createIfNone' : t.silent ? 'silent' : 'default';
            output.info(`    ${Math.round(t.elapsed)}ms  tenant=${tenant}  mode=${mode}`);
        }
        output.info(`  Total getSession calls: ${getSessionFromVSCodeTimings.length}, total time: ${Math.round(getSessionFromVSCodeTimings.reduce((a, b) => a + b.elapsed, 0))}ms`);
    }

    // ── Step 4: Warm profiled runs (cached) ──────────────────────────
    const warmRuns = 5;
    /** @type {number[]} */
    const warmTimes = [];

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
        for (const t of getSessionFromVSCodeTimings) {
            const tenant = t.tenantId ? t.tenantId.substring(0, 8) + '…' : '(default)';
            const mode = t.createIfNone ? 'createIfNone' : t.silent ? 'silent' : 'default';
            output.info(`    ${Math.round(t.elapsed)}ms  tenant=${tenant}  mode=${mode}`);
        }
        output.info(`  Total getSession calls: ${getSessionFromVSCodeTimings.length}, total time: ${Math.round(getSessionFromVSCodeTimings.reduce((a, b) => a + b.elapsed, 0))}ms`);
    }

    // ── Final summary ────────────────────────────────────────────────
    output.info('');
    output.info('═══════════════════════════════════════════════════════');
    output.info('  Cold Runs Variance Summary');
    output.info('═══════════════════════════════════════════════════════');
    output.info(`  Runs: ${coldTimes.map(t => `${Math.round(t)}ms`).join(', ')}`);
    output.info(`  Min:  ${Math.round(Math.min(...coldTimes))}ms`);
    output.info(`  Max:  ${Math.round(Math.max(...coldTimes))}ms`);
    output.info(`  Avg:  ${Math.round(coldTimes.reduce((a, b) => a + b, 0) / coldTimes.length)}ms`);

    output.info('');
    output.info('═══════════════════════════════════════════════════════');
    output.info('  Warm Runs (Cached) Variance Summary');
    output.info('═══════════════════════════════════════════════════════');
    output.info(`  Runs: ${warmTimes.map(t => `${Math.round(t)}ms`).join(', ')}`);
    output.info(`  Min:  ${Math.round(Math.min(...warmTimes))}ms`);
    output.info(`  Max:  ${Math.round(Math.max(...warmTimes))}ms`);
    output.info(`  Avg:  ${Math.round(warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length)}ms`);

    provider.dispose();

    vscode.window.showInformationMessage('Azure Auth Perf: Profiling complete — see output channel.');
}

function deactivate() { }

module.exports = { activate, deactivate };
