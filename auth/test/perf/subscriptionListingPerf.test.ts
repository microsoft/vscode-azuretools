/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as vscode from 'vscode';
import { InstrumentedSubscriptionProvider } from './InstrumentedSubscriptionProvider';

/**
 * Performance profiling tests for subscription listing.
 *
 * These tests require a real VS Code instance with at least one Azure account
 * signed in. Run via `npm test` (which uses .vscode-test.mjs to launch VS Code).
 *
 * The tests themselves do not assert specific latency bounds — they simply
 * print a detailed timing report to the console so you can see which phase
 * is slow:
 *
 *   - vscode.authentication.getAccounts (VSCode API)
 *   - getToken / vscode.authentication.getSession (VSCode token acquisition)
 *   - ARM tenants.list
 *   - ARM subscriptions.list
 *   - Module import of @azure/arm-resources-subscriptions
 */

suite('Subscription Listing Performance', function () {
    // Allow up to 2 minutes — real ARM calls can be slow
    this.timeout(120_000);

    let provider: InstrumentedSubscriptionProvider;
    let logger: vscode.LogOutputChannel;
    let signedIn = false;

    suiteSetup(async function () {
        this.timeout(120_000);

        logger = vscode.window.createOutputChannel('AuthPerfTest', { log: true });
        provider = new InstrumentedSubscriptionProvider(logger);

        // VS Code's test host blocks interactive dialogs when both
        // --extensionDevelopmentPath and --extensionTestsPath are set
        // (isExtensionDevelopment && extensionTestsLocationURI).
        // So we can't call signIn() interactively. Instead we try a
        // silent sign-in + warm-up; if it fails, the profile doesn't
        // have cached Azure sessions and we skip the perf tests.
        //
        // To make the tests work:
        //   1. Sign in to Azure in your normal VS Code window first
        //   2. Use `--profile=Default` and `useInstallation: { fromMachine: true }`
        //      in .vscode-test.mjs so the test host reuses your sessions
        console.log('Performing silent warm-up (no interactive auth in test host)...');
        try {
            // Try silent sign-in only — won't show any dialogs
            signedIn = await provider.signIn(undefined, { promptIfNeeded: false });
            if (signedIn) {
                await provider.getAvailableSubscriptions({ noCache: true, filter: false });
                console.log('Warm-up complete — Azure sessions found.\n');
            }
        } catch (err) {
            console.log(`Silent sign-in failed: ${err}`);
            signedIn = false;
        }
        provider.tracker.reset();

        if (!signedIn) {
            console.log('WARNING: No Azure sessions available — perf tests will be skipped.');
            console.log('To grant auth consent, run the "Grant Auth Consent" launch config (F5) first.');
            console.log('That opens a normal Extension Development Host where the consent dialog works.');
            console.log('After granting consent once, re-run these tests.\n');
        }
    });

    setup(function () {
        if (!signedIn) {
            this.skip();
        }
    });

    suiteTeardown(function () {
        provider.dispose();
        logger.dispose();
    });

    test('profile getAvailableSubscriptions (cold, no cache)', async function () {
        // Force no-cache so every call hits the network / VSCode APIs
        const subscriptions = await provider.getAvailableSubscriptions({ noCache: true, filter: false });

        const report = provider.tracker.formatReport();
        const summary = provider.tracker.getSummary();

        console.log('\n╔══════════════════════════════════════════════════════════════════╗');
        console.log('║  COLD (no cache) Subscription Listing Performance Report        ║');
        console.log('╚══════════════════════════════════════════════════════════════════╝\n');
        console.log(report);
        console.log('\n── Summary by phase ──');
        for (const [phase, data] of Object.entries(summary)) {
            console.log(`  ${phase}: ${Math.round(data.totalMs)}ms total (${data.count} call(s))`);
        }
        console.log(`\nTotal subscriptions returned: ${subscriptions.length}`);

        // Basic sanity — the provider must not throw
        assert.ok(Array.isArray(subscriptions));
    });

    test('profile getAvailableSubscriptions (warm, cached)', async function () {
        // First call to warm the cache (resets the tracker internally)
        await provider.getAvailableSubscriptions({ noCache: true, filter: false });

        // Second call — should be fast because of cache
        const subscriptions = await provider.getAvailableSubscriptions({ filter: false });

        const report = provider.tracker.formatReport();
        const summary = provider.tracker.getSummary();

        console.log('\n╔══════════════════════════════════════════════════════════════════╗');
        console.log('║  WARM (cached) Subscription Listing Performance Report          ║');
        console.log('╚══════════════════════════════════════════════════════════════════╝\n');
        console.log(report);
        console.log('\n── Summary by phase ──');
        for (const [phase, data] of Object.entries(summary)) {
            console.log(`  ${phase}: ${Math.round(data.totalMs)}ms total (${data.count} call(s))`);
        }
        console.log(`\nTotal subscriptions returned: ${subscriptions.length}`);

        assert.ok(Array.isArray(subscriptions));
    });

    test('profile getAccounts in isolation', async function () {
        provider.tracker.reset();
        const accounts = await provider.getAccounts({ noCache: true });

        const report = provider.tracker.formatReport();
        console.log('\n── getAccounts() timing ──');
        console.log(report);
        console.log(`Accounts found: ${accounts.length}`);

        assert.ok(accounts.length > 0, 'Expected at least one signed-in account');
    });

    test('profile getTenantsForAccount in isolation', async function () {
        const accounts = await provider.getAccounts({ noCache: true });
        assert.ok(accounts.length > 0, 'Expected at least one signed-in account');

        for (const account of accounts) {
            provider.tracker.reset();
            const tenants = await provider.getTenantsForAccount(account, { noCache: true, filter: false });

            const report = provider.tracker.formatReport();
            console.log(`\n── getTenantsForAccount("${account.id.substring(0, 4)}…") timing ──`);
            console.log(report);
            console.log(`Tenants found: ${tenants.length}`);

            assert.ok(Array.isArray(tenants));
        }
    });

    test('profile getSubscriptionsForTenant in isolation', async function () {
        const accounts = await provider.getAccounts({ noCache: true });
        assert.ok(accounts.length > 0, 'Expected at least one signed-in account');

        for (const account of accounts) {
            const tenants = await provider.getTenantsForAccount(account, { noCache: true, filter: false });

            for (const tenant of tenants) {
                provider.tracker.reset();

                try {
                    const subs = await provider.getSubscriptionsForTenant(tenant, { noCache: true, filter: false });

                    const report = provider.tracker.formatReport();
                    console.log(`\n── getSubscriptionsForTenant("${tenant.tenantId.substring(0, 8)}…") timing ──`);
                    console.log(report);
                    console.log(`Subscriptions found: ${subs.length}`);

                    assert.ok(Array.isArray(subs));
                } catch (err) {
                    // Some tenants may not be authenticated — that's OK, we still want the timing data
                    const report = provider.tracker.formatReport();
                    console.log(`\n── getSubscriptionsForTenant("${tenant.tenantId.substring(0, 8)}…") FAILED ──`);
                    console.log(report);
                    console.log(`Error: ${err}`);
                }
            }
        }
    });

    test('profile multiple cold runs to check variance', async function () {
        const runs = 3;
        const e2eTimes: number[] = [];

        for (let i = 0; i < runs; i++) {
            provider.tracker.reset();
            const start = performance.now();
            await provider.getAvailableSubscriptions({ noCache: true, filter: false });
            const elapsed = performance.now() - start;
            e2eTimes.push(elapsed);

            console.log(`\n── Run ${i + 1}/${runs}: ${Math.round(elapsed)}ms ──`);
            const summary = provider.tracker.getSummary();
            for (const [phase, data] of Object.entries(summary)) {
                console.log(`  ${phase}: ${Math.round(data.totalMs)}ms (${data.count}x)`);
            }
        }

        console.log('\n── Variance summary ──');
        console.log(`  Runs: ${e2eTimes.map(t => `${Math.round(t)}ms`).join(', ')}`);
        console.log(`  Min:  ${Math.round(Math.min(...e2eTimes))}ms`);
        console.log(`  Max:  ${Math.round(Math.max(...e2eTimes))}ms`);
        console.log(`  Avg:  ${Math.round(e2eTimes.reduce((a, b) => a + b, 0) / e2eTimes.length)}ms`);
    });
});
