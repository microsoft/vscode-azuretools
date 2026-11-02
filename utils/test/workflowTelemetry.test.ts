/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { transform } from 'esbuild';
import { performance } from 'perf_hooks';
import { mock } from 'node:test';
import { runInNewContext } from 'vm';
import { CancellationError, window } from 'vscode';
import type * as types from '../index';
import { AzureWizard, AzureWizardPromptStep, callWithTelemetryAndErrorHandling, createTestActionContext, initializeWorkflowTelemetry, recordWorkflowRetry, setWorkflowOutcome, setWorkflowTelemetryDetails, startWorkflowUserWait, UserCancelledError, withTelemetryStage } from '../src';
import { ext } from '../src/extensionVariables';
import { addStepTelemetry } from '../src/userInput/AzExtUserInput';
import { classifyWorkflowError, finalizeWorkflowTelemetry } from '../src/workflowTelemetry';

interface CapturedEvent {
    name: string;
    properties: types.TelemetryProperties;
    measurements: types.TelemetryMeasurements;
}

suite('workflow telemetry', () => {
    let events: CapturedEvent[];
    let now: number;
    setup(() => {
        events = [];
        now = 0;
        mock.method(performance, 'now', () => now);
        mock.method(ext._internalReporter, 'sendTelemetryErrorEvent', (name: string, properties?: types.TelemetryProperties, measurements?: types.TelemetryMeasurements) => {
            events.push({ name, properties: { ...properties }, measurements: { ...measurements } });
        });
    });
    teardown(() => mock.restoreAll());

    function rootEvent(name: string = 'root'): CapturedEvent {
        const event = events.find(e => e.name === name);
        assert.ok(event, `Missing ${name} event`);
        return event;
    }

    function initialize(context: types.IActionContext): void {
        context.errorHandling.suppressDisplay = true;
        initializeWorkflowTelemetry(context, { workflow: 'createProject', command: 'createNewProject', stepNames: ['selectRuntime', 'legacyPrompt'] });
    }

    test('root and copied child snapshots share correlation, not user attempts', async () => {
        await callWithTelemetryAndErrorHandling('root', async parent => {
            initialize(parent);
            assert.strictEqual(parent.telemetry.properties.outcome, undefined);
            const parentAttempt = parent.telemetry.properties.attemptId;
            await callWithTelemetryAndErrorHandling('child', child => {
                child.telemetry.properties = { ...parent.telemetry.properties };
                child.telemetry.measurements = { ...parent.telemetry.measurements };
                initializeWorkflowTelemetry(child, { workflow: 'createFunction', command: 'createFunction' }, parent);
                assert.notStrictEqual(child.telemetry.properties.attemptId, parentAttempt);
                now = 20;
            });
            now = 50;
        });
        const root = rootEvent();
        const child = rootEvent('child');
        assert.strictEqual(root.properties.workflowSchemaVersion, '1');
        assert.strictEqual(root.properties.isWorkflowRoot, 'true');
        assert.strictEqual(child.properties.isWorkflowRoot, 'false');
        assert.strictEqual(child.properties.parentAttemptId, root.properties.attemptId);
        assert.strictEqual(child.properties.workflowRunId, root.properties.workflowRunId);
        assert.strictEqual(child.properties.command, 'createNewProject');
        assert.strictEqual(root.properties.result, 'Succeeded');
        assert.strictEqual(root.properties.outcome, 'succeeded');
        assert.strictEqual(root.measurements.userWaitDuration, undefined);
        assert.strictEqual(root.measurements.retryCount, undefined);
    });

    test('nested action stages parent to their own action, not the parent active stage', async () => {
        await callWithTelemetryAndErrorHandling('root', async parent => {
            initialize(parent);
            await withTelemetryStage(parent, { stage: 'projectCreation' }, async () => {
                await callWithTelemetryAndErrorHandling('child', async child => {
                    initializeWorkflowTelemetry(child, { workflow: 'createFunction', command: 'createFunction' }, parent);
                    await withTelemetryStage(child, { stage: 'functionCreation' }, () => Promise.resolve());
                });
            });
        });
        const outer = events.find(e => e.properties.stage === 'projectCreation');
        const inner = events.find(e => e.properties.stage === 'functionCreation');
        assert.ok(outer && inner);
        assert.strictEqual(rootEvent('child').properties.parentAttemptId, outer.properties.attemptId);
        assert.strictEqual(inner.properties.parentAttemptId, rootEvent('child').properties.attemptId);
        assert.strictEqual(inner.properties.workflowRunId, rootEvent().properties.workflowRunId);
    });

    test('suppressed successful roots still finalize before detached diagnostics', async () => {
        let parent: types.IActionContext | undefined;
        await callWithTelemetryAndErrorHandling('root', context => {
            initialize(context);
            context.telemetry.suppressIfSuccessful = true;
            parent = context;
            now = 10;
        });
        assert.ok(parent);
        assert.strictEqual(events.length, 0);
        assert.strictEqual(parent.telemetry.properties.outcome, 'succeeded');
        assert.strictEqual(parent.telemetry.measurements.workflowDuration, 0.01);
        await callWithTelemetryAndErrorHandling('child', async child => {
            initializeWorkflowTelemetry(child, { workflow: 'createProject', command: 'createNewProject' }, parent);
            now = 20;
            await withTelemetryStage(child, { stage: 'completion', attempt: 2 }, () => Promise.resolve());
        });
        assert.strictEqual(parent.telemetry.measurements.retryCount, undefined);
        assert.strictEqual(parent.telemetry.measurements.workflowDuration, 0.01);
        assert.strictEqual(rootEvent('child').properties.isWorkflowRoot, 'false');
    });

    for (const [outcome, reason, code] of [
        ['handedOff', 'templateGallery', undefined],
        ['blocked', 'prerequisite', 'coreToolsUnavailable'],
        ['failed', 'preDeployTask', 'preDeployTaskFailed']
    ] as const) {
        test(`legacy cancellation preserves explicit ${outcome}`, async () => {
            await callWithTelemetryAndErrorHandling('root', context => {
                initialize(context);
                setWorkflowOutcome(context, outcome, { cancelReason: reason, failureCode: code });
                throw new UserCancelledError('https://private.example/resource');
            });
            const event = rootEvent();
            assert.strictEqual(event.properties.result, 'Canceled');
            assert.strictEqual(event.properties.outcome, outcome);
            assert.strictEqual(event.properties.cancelReason, reason);
            assert.strictEqual(event.properties.failureCode, code);
            assert.notStrictEqual(event.properties.lastStep, 'https://private.example/resource');
        });
    }

    test('actual dialog dismissal has observed wait and a distinct reason', async () => {
        mock.method(window, 'showOpenDialog', () => {
            now = 75;
            return Promise.resolve(undefined);
        });
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            now = 25;
            await context.ui.showOpenDialog({ title: 'Private project path' });
        });
        const event = rootEvent();
        assert.strictEqual(event.properties.outcome, 'canceled');
        assert.strictEqual(event.properties.cancelReason, 'userDismissed');
        assert.strictEqual(event.measurements.workflowDuration, 0.075);
        assert.strictEqual(event.measurements.userWaitDuration, 0.05);
        assert.strictEqual(event.measurements.activeDuration, 0.025);
        assert.strictEqual(event.properties.lastStep, 'openDialog');
    });

    test('minified steps keep stable telemetry and distinct runtime UUIDs', async () => {
        const bundled = await transform(`globalThis.createStep = (Base => new (class OriginalStep extends Base {
            telemetryId = 'selectRuntime';
            shouldPrompt() { return true; }
            async prompt() {}
        }))`, { minify: true, target: 'es2022' });
        const createStep = runInNewContext(bundled.code) as (base: typeof AzureWizardPromptStep) => AzureWizardPromptStep<types.IActionContext>;
        const first = createStep(AzureWizardPromptStep);
        const second = createStep(AzureWizardPromptStep);
        assert.notStrictEqual(first.id, second.id);
        assert.notStrictEqual(first.constructor.name, 'OriginalStep');
        const context = await createTestActionContext();
        initialize(context);
        await new AzureWizard(context, { promptSteps: [first, second] }).prompt();
        assert.strictEqual(context.telemetry.properties.lastStep, 'prompt-selectRuntime');
        assert.match(first.id, /^[\da-f-]{36}$/i);
        assert.match(second.id, /^[\da-f-]{36}$/i);
    });

    test('registered stepName is a compatibility fallback, never constructor or runtime id', async () => {
        class LegacyStep extends AzureWizardPromptStep<types.IActionContext> {
            public stepName = 'legacyPrompt';
            public shouldPrompt(): boolean { return true; }
            public prompt(): Promise<void> { return Promise.resolve(); }
        }
        const context = await createTestActionContext();
        initialize(context);
        const step = new LegacyStep();
        await new AzureWizard(context, { promptSteps: [step] }).prompt();
        assert.strictEqual(context.telemetry.properties.lastStep, 'prompt-legacyPrompt');
        step.stepName = step.id;
        await new AzureWizard(context, { promptSteps: [step] }).prompt();
        assert.strictEqual(context.telemetry.properties.lastStep, 'prompt-unknown');
    });

    test('UI, error and reserved-field metadata cannot inject normalized values', async () => {
        await callWithTelemetryAndErrorHandling('root', context => {
            initialize(context);
            addStepTelemetry(context, 'selectRuntime', 'quickPick', 'private resource');
            addStepTelemetry(context, 'C:\\private\\project', 'inputBox', 'https://private.example');
            assert.strictEqual(context.telemetry.properties.lastStep, 'inputBox');
            addStepTelemetry(context, 'selectRuntime', 'quickPick', undefined);
            setWorkflowTelemetryDetails(context, JSON.parse('{"failureCode":"private-resource","deploymentMechanism":"https://private","retryable":"yes"}') as types.WorkflowTelemetryDetails);
            context.telemetry.properties.workflow = 'private-resource';
            context.telemetry.properties.workflowRunId = 'private-resource';
            context.telemetry.properties.outcome = 'private-resource';
            throw Object.assign(new Error('legacy message'), { stepName: 'private-resource' });
        });
        const event = rootEvent();
        assert.strictEqual(event.properties.lastStep, 'selectRuntime');
        assert.strictEqual(event.properties.workflow, 'createProject');
        assert.strictEqual(event.properties.outcome, 'failed');
        assert.strictEqual(event.properties.failureCode, 'unknown');
        assert.strictEqual(event.properties.deploymentMechanism, 'unknown');
        assert.strictEqual(event.properties.retryable, undefined);
        const runId = event.properties.workflowRunId;
        assert.ok(typeof runId === 'string');
        assert.match(runId, /^[\da-f-]{36}$/i);
        for (const stage of events.filter(e => e.name === 'workflowStage')) {
            assert.doesNotMatch(JSON.stringify(stage), /private-resource|private\.example|C:\\/);
        }
    });

    test('registered parsed-error metadata is useful while UUID registry entries are rejected', async () => {
        const uuid = 'abcdefab-abcd-abcd-abcd-abcdefabcdef';
        await callWithTelemetryAndErrorHandling('root', context => {
            initialize(context);
            initializeWorkflowTelemetry(context, { workflow: 'createProject', command: 'createNewProject', stepNames: [uuid] });
            addStepTelemetry(context, uuid, 'quickPick', undefined);
            assert.strictEqual(context.telemetry.properties.lastStep, 'quickPick');
            throw Object.assign(new Error('legacy failure'), { stepName: 'legacyPrompt' });
        });
        assert.strictEqual(rootEvent().properties.lastStep, 'legacyPrompt');
    });

    test('observed zero-length wait is available rather than an invented unavailable signal', async () => {
        await callWithTelemetryAndErrorHandling('root', context => {
            initialize(context);
            startWorkflowUserWait(context).dispose();
        });
        assert.strictEqual(rootEvent().properties.userWaitTiming, 'available');
        assert.strictEqual(rootEvent().measurements.userWaitDuration, 0);
    });

    test('overlapping child waits use interval union and reconcile with duration', async () => {
        await callWithTelemetryAndErrorHandling('root', async parent => {
            initialize(parent);
            now = 10;
            const outer = startWorkflowUserWait(parent);
            now = 20;
            await callWithTelemetryAndErrorHandling('child', child => {
                initializeWorkflowTelemetry(child, { workflow: 'createProject', command: 'createNewProject' }, parent);
                now = 30;
                const inner = startWorkflowUserWait(child);
                now = 40;
                inner.dispose();
                inner.dispose();
                now = 50;
                outer.dispose();
                now = 60;
            });
            now = 100;
        });
        assert.strictEqual(rootEvent().measurements.workflowDuration, 0.1);
        assert.strictEqual(rootEvent().measurements.userWaitDuration, 0.04);
        assert.strictEqual(rootEvent().measurements.activeDuration, 0.06);
        assert.strictEqual(rootEvent('child').measurements.userWaitDuration, 0.03);
    });

    test('a live child retains prior wait observations when its parent finalizes first', async () => {
        const child = await createTestActionContext();
        let first: types.WorkflowUserWaitTimer | undefined;
        await callWithTelemetryAndErrorHandling('root', parent => {
            initialize(parent);
            now = 1;
            initializeWorkflowTelemetry(child, { workflow: 'createProject', command: 'createNewProject' }, parent);
            first = startWorkflowUserWait(child);
            now = 10;
        });
        now = 20;
        const second = startWorkflowUserWait(child);
        now = 30;
        second.dispose();
        now = 40;
        first?.dispose();
        finalizeWorkflowTelemetry(child);
        assert.strictEqual(rootEvent().measurements.userWaitDuration, 0.009);
        assert.strictEqual(child.telemetry.measurements.userWaitDuration, 0.039);
        assert.strictEqual(child.telemetry.measurements.activeDuration, 0);
    });

    test('exception timing closes stages and outstanding waits at the observed end', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await withTelemetryStage(context, { stage: 'projectCreation' }, () => {
                now = 10;
                startWorkflowUserWait(context);
                now = 30;
                throw Object.assign(new Error('do not emit this'), { code: 'ETIMEDOUT' });
            });
        });
        const stage = events.find(e => e.name === 'workflowStage');
        assert.ok(stage);
        assert.strictEqual(stage.properties.outcome, 'failed');
        assert.strictEqual(stage.properties.failureCode, 'timeout');
        assert.strictEqual(stage.measurements.workflowDuration, 0.03);
        assert.strictEqual(stage.measurements.userWaitDuration, 0.02);
        assert.strictEqual(rootEvent().measurements.activeDuration, 0.01);
    });

    test('native cancellation closes timing without turning the stage into a failure', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await withTelemetryStage(context, { stage: 'prompt' }, () => {
                now = 10;
                startWorkflowUserWait(context);
                now = 40;
                throw new CancellationError();
            });
        });
        const stage = events.find(e => e.name === 'workflowStage');
        assert.ok(stage);
        assert.strictEqual(stage.properties.outcome, 'canceled');
        assert.strictEqual(rootEvent().properties.outcome, 'canceled');
        assert.strictEqual(rootEvent().measurements.workflowDuration, 0.04);
        assert.strictEqual(rootEvent().measurements.userWaitDuration, 0.03);
        assert.strictEqual(rootEvent().measurements.activeDuration, 0.01);
    });

    test('an actual exception replaces a provisional stage success', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await withTelemetryStage(context, { stage: 'completion' }, stage => {
                stage.setOutcome('succeeded');
                throw new Error('private subsequent failure');
            });
        });
        assert.strictEqual(events.find(e => e.properties.stage === 'completion')?.properties.outcome, 'failed');
        assert.strictEqual(rootEvent().properties.outcome, 'failed');
    });

    test('explicit trigger-discovery failure retains independent structured HTTP and network facts', async () => {
        await callWithTelemetryAndErrorHandling('root', context => {
            initialize(context);
            setWorkflowTelemetryDetails(context, { deploymentStatus: 'succeeded' });
            setWorkflowOutcome(context, 'failed', { failureCategory: 'deployment', failureCode: 'triggerDiscoveryFailed' });
            throw Object.assign(new Error('private response body'), { statusCode: 503, code: 'ENOTFOUND' });
        });
        assert.strictEqual(rootEvent().properties.result, 'Failed');
        assert.strictEqual(rootEvent().properties.outcome, 'failed');
        assert.strictEqual(rootEvent().properties.deploymentStatus, 'succeeded');
        assert.strictEqual(rootEvent().properties.failureCode, 'triggerDiscoveryFailed');
        assert.strictEqual(rootEvent().properties.networkCategory, 'dns');
        assert.strictEqual(rootEvent().properties.httpStatus, '5xx');
    });

    test('numbered stages count actual retries and prove recovery from an earlier failure', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await withTelemetryStage(context, { stage: 'deployment' }, async () => {
                await assert.rejects(withTelemetryStage(context, { stage: 'upload', attempt: 1 }, () => Promise.reject(new Error('failed upload'))));
                await withTelemetryStage(context, { stage: 'upload', attempt: 2 }, () => Promise.resolve());
            });
        });
        const root = rootEvent();
        const attempts = events.filter(e => e.name === 'workflowStage' && e.properties.stage === 'upload');
        assert.strictEqual(root.measurements.retryCount, 1);
        assert.strictEqual(root.properties.recoveredAfterRetry, 'true');
        assert.strictEqual(attempts.length, 2);
        assert.notStrictEqual(attempts[0].properties.attemptId, attempts[1].properties.attemptId);
        assert.strictEqual(attempts[0].properties.parentAttemptId, attempts[1].properties.parentAttemptId);
        assert.strictEqual(attempts[1].properties.isWorkflowRoot, 'false');
        assert.strictEqual(attempts[1].properties.workflowRunId, root.properties.workflowRunId);
    });

    test('explicit retry counter observes stage recovery without double counting', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await withTelemetryStage(context, { stage: 'preDeployTask' }, stage => {
                stage.setOutcome('failed', { failureCategory: 'task', failureCode: 'preDeployTaskFailed' });
                return Promise.resolve();
            });
            recordWorkflowRetry(context);
            await withTelemetryStage(context, { stage: 'preDeployTask' }, () => Promise.resolve());
        });
        assert.strictEqual(rootEvent().measurements.retryCount, 1);
        assert.strictEqual(rootEvent().properties.recoveredAfterRetry, 'true');
        assert.strictEqual(rootEvent().properties.outcome, 'succeeded');
    });

    test('retry without observed prior failure and polling iterations do not imply recovery', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await withTelemetryStage(context, { stage: 'polling' }, () => Promise.resolve());
            await withTelemetryStage(context, { stage: 'polling' }, () => Promise.resolve());
            assert.strictEqual(context.telemetry.measurements.retryCount, undefined);
            await withTelemetryStage(context, { stage: 'upload', attempt: 2 }, () => Promise.resolve());
        });
        assert.strictEqual(rootEvent().measurements.retryCount, 1);
        assert.strictEqual(rootEvent().properties.recoveredAfterRetry, undefined);
    });

    test('failed stage followed by continuation does not terminate a successful root', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await withTelemetryStage(context, { stage: 'preDeployTask' }, stage => {
                stage.setOutcome('failed', { failureCode: 'preDeployTaskFailed' });
                return Promise.resolve();
            });
        });
        assert.strictEqual(rootEvent().properties.outcome, 'succeeded');
        assert.strictEqual(rootEvent().properties.failureCode, undefined);
        assert.strictEqual(rootEvent().properties.recoveredAfterRetry, undefined);
    });

    test('observed deployment success does not hide a later command failure', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await withTelemetryStage(context, { stage: 'completion' }, () => {
                setWorkflowTelemetryDetails(context, { deploymentStatus: 'succeeded', deploymentMechanism: 'zip' });
                return Promise.resolve();
            });
            throw Object.assign(new Error('trigger discovery failed'), { statusCode: 503 });
        });
        assert.strictEqual(rootEvent().properties.deploymentStatus, 'succeeded');
        assert.strictEqual(rootEvent().properties.outcome, 'failed');
        assert.strictEqual(rootEvent().properties.result, 'Failed');
        assert.strictEqual(rootEvent().properties.httpStatus, '5xx');
    });

    test('late child diagnostics cannot mutate or resurrect the finalized root', async () => {
        let parent: types.IActionContext | undefined;
        await callWithTelemetryAndErrorHandling('root', context => {
            initialize(context);
            parent = context;
            now = 100;
        });
        assert.ok(parent);
        const original = JSON.stringify(rootEvent());
        now = 200;
        await callWithTelemetryAndErrorHandling('child', async child => {
            initializeWorkflowTelemetry(child, { workflow: 'deploy', command: 'deploy' }, parent);
            await assert.rejects(withTelemetryStage(child, { stage: 'completion', attempt: 1 }, () => Promise.reject(new Error('late'))));
            await withTelemetryStage(child, { stage: 'completion', attempt: 2 }, () => {
                now = 220;
                const wait = startWorkflowUserWait(child);
                now = 250;
                wait.dispose();
                return Promise.resolve();
            });
            now = 300;
        });
        finalizeWorkflowTelemetry(parent);
        assert.strictEqual(JSON.stringify(rootEvent()), original);
        assert.strictEqual(parent.telemetry.measurements.retryCount, undefined);
        assert.strictEqual(parent.telemetry.measurements.workflowDuration, 0.1);
        assert.strictEqual(rootEvent('child').measurements.retryCount, 1);
        assert.strictEqual(rootEvent('child').measurements.userWaitDuration, 0.03);
        assert.strictEqual(rootEvent('child').properties.isWorkflowRoot, 'false');
    });

    test('structured diagnostics are finite and never copy arbitrary codes or message text', () => {
        assert.deepStrictEqual(classifyWorkflowError({ code: 'ENOTFOUND', message: 'secret host' }), { failureCategory: 'network', failureCode: 'dns', networkCategory: 'dns' });
        assert.deepStrictEqual(classifyWorkflowError({ statusCode: 403, body: 'secret' }), { failureCategory: 'authorization', failureCode: 'httpForbidden', httpStatus: 403 });
        assert.deepStrictEqual(classifyWorkflowError({ code: 'private resource', message: 'ETIMEDOUT secret' }), { failureCategory: 'unknown', failureCode: 'unknown' });
    });
});
