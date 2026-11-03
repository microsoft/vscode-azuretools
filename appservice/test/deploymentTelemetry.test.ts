/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WebSiteManagementClient } from '@azure/arm-appservice';
import { createHttpHeaders, createPipelineRequest } from '@azure/core-rest-pipeline';
import { AzExtPipelineResponse } from '@microsoft/vscode-azext-azureutils';
import { callWithTelemetryAndErrorHandling, IActionContext, initializeWorkflowTelemetry, ISubscriptionContext, TelemetryMeasurements, TelemetryProperties, withTelemetryStage } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import { mock } from 'node:test';
import * as vscode from 'vscode';
import { ParsedSite, SiteClient } from '../src/SiteClient';
import { ScmType } from '../src/ScmType';
import { IDeployContext } from '../src/deploy/IDeployContext';
import { getDeploymentStatusDetails, trackDeploymentUpload } from '../src/deploy/deploymentTelemetry';
import { handleFailedPreDeployTask, runPreDeployTask, tryRunPreDeployTask } from '../src/deploy/runDeployTask';
import { syncTriggersPostDeploy } from '../src/deploy/syncTriggersPostDeploy';
import { waitForDeploymentToComplete } from '../src/deploy/waitForDeploymentToComplete';
import { PostDeployTaskExecuteStep } from '../src/deploy/wizard/PostDeployTaskExecuteStep';
import { ext } from '../src/extensionVariables';
import { retryKuduCall } from '../src/utils/kuduUtils';
import { taskUtils } from '../src/utils/taskUtils';

interface CapturedEvent { name: string; properties: TelemetryProperties; measurements: TelemetryMeasurements }
interface Reporter { sendTelemetryErrorEvent(name: string, properties?: TelemetryProperties, measurements?: TelemetryMeasurements): void }

suite('deployment telemetry', () => {
    let events: CapturedEvent[];
    let site: ParsedSite;
    let client: SiteClient;
    setup(() => {
        events = [];
        // eslint-disable-next-line @typescript-eslint/naming-convention -- capture the package's existing private reporter seam
        const owner = ext as typeof ext & { _internalReporter: Reporter };
        mock.method(owner._internalReporter, 'sendTelemetryErrorEvent', (name: string, properties?: TelemetryProperties, measurements?: TelemetryMeasurements) => {
            events.push({ name, properties: { ...properties }, measurements: { ...measurements } });
        });
        mock.method(vscode.window, 'showErrorMessage', () => Promise.resolve(undefined));
        site = new ParsedSite({
            id: '/subscriptions/private/resourceGroups/private/providers/Microsoft.Web/sites/private',
            name: 'private-app', location: 'westus', resourceGroup: 'private-rg', kind: 'functionapp',
            defaultHostName: 'private.azurewebsites.net', hostNameSslStates: [],
            serverFarmId: '/subscriptions/private/resourceGroups/private/providers/Microsoft.Web/serverfarms/private'
        }, {} as ISubscriptionContext);
        client = new SiteClient({} as WebSiteManagementClient, site);
        mock.method(site, 'createClient', () => Promise.resolve(client));
        mock.method(client, 'getLogEntry', () => Promise.resolve([]));
    });
    teardown(() => mock.restoreAll());

    function initialize(context: IActionContext): void {
        context.errorHandling.suppressDisplay = true;
        initializeWorkflowTelemetry(context, { workflow: 'deploy', command: 'deploy' });
    }

    function rootEvent(): CapturedEvent {
        const event = events.find(e => e.name === 'root');
        assert.ok(event);
        return event;
    }

    function deployContext(context: IActionContext): IDeployContext {
        return Object.assign(context, {
            workspaceFolder: { uri: vscode.Uri.file('C:\\private'), name: 'private', index: 0 },
            originalDeployFsPath: 'C:\\private', effectiveDeployFsPath: 'C:\\private',
            defaultAppSetting: 'default', deployMethod: 'zip' as const
        });
    }

    test('upload acceptance uses bounded HTTP metadata and never infers completion', async () => {
        const response: AzExtPipelineResponse = {
            status: 202, request: createPipelineRequest({ url: 'https://private.example/deployment' }),
            headers: createHttpHeaders({ location: 'https://private.example/status', 'scm-deployment-id': 'private-id' }),
            bodyAsText: 'private-body', parsedBody: { resourceName: 'private-app' }
        };
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            assert.strictEqual(await trackDeploymentUpload(context, 'flex', () => Promise.resolve(response)), response);
        });
        const stages = events.filter(e => e.name === 'workflowStage');
        assert.strictEqual(stages.length, 2);
        assert.strictEqual(stages[0].properties.stage, 'upload');
        assert.strictEqual(stages[1].properties.stage, 'acceptance');
        assert.strictEqual(stages[1].properties.deploymentStatus, 'accepted');
        assert.strictEqual(stages[1].properties.httpStatus, '2xx');
        assert.strictEqual(rootEvent().properties.deploymentMechanism, 'flex');
        assert.notStrictEqual(rootEvent().properties.deploymentStatus, 'succeeded');
        assert.doesNotMatch(JSON.stringify(stages), /private/);
    });

    test('upload network failures emit categories, not exception messages', async () => {
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await trackDeploymentUpload(context, 'zip', () => Promise.reject(Object.assign(new Error('private URL and response'), { code: 'ETIMEDOUT' })));
        });
        const stage = events.find(e => e.name === 'workflowStage');
        assert.ok(stage);
        assert.strictEqual(stage.properties.networkCategory, 'timeout');
        assert.strictEqual(stage.properties.failureCategory, 'network');
        assert.strictEqual(stage.properties.retryable, undefined);
        assert.doesNotMatch(JSON.stringify(stage), /private|response/);
        assert.strictEqual(rootEvent().properties.outcome, 'failed');
    });

    for (const [status, outcome] of [
        [403, 'failed'], [429, 'failed'], [500, 'failed'], [302, 'unknown']
    ] as const) {
        test(`HTTP acceptance ${status} preserves the response without implying deployment completion`, async () => {
            const response: AzExtPipelineResponse = {
                status, request: createPipelineRequest({ url: 'https://private.example/deployment' }),
                headers: createHttpHeaders(), bodyAsText: 'private-body'
            };
            let invocations = 0;
            await callWithTelemetryAndErrorHandling('root', async context => {
                initialize(context);
                assert.strictEqual(await trackDeploymentUpload(context, 'zip', () => {
                    invocations++;
                    return Promise.resolve(response);
                }), response);
            });
            const acceptance = events.find(e => e.properties.stage === 'acceptance');
            assert.ok(acceptance);
            assert.strictEqual(acceptance.properties.outcome, outcome);
            assert.strictEqual(acceptance.properties.httpStatus, `${Math.floor(status / 100)}xx`);
            assert.strictEqual(acceptance.properties.deploymentStatus, 'unknown');
            assert.strictEqual(invocations, 1);
            assert.strictEqual(rootEvent().properties.result, 'Succeeded');
            assert.doesNotMatch(JSON.stringify(events.filter(e => e.name === 'workflowStage')), /private/);
        });
    }

    for (const [status, legacyResult, outcome, deploymentStatus, code] of [
        [4, 'Succeeded', 'succeeded', 'succeeded', undefined],
        [3, 'Failed', 'failed', 'failed', 'deploymentFailed'],
        [5, 'Failed', 'canceled', 'canceled', 'deploymentSuperseded'],
        [-1, 'Failed', 'canceled', 'canceled', 'deploymentCanceled'],
        [6, 'Succeeded', 'unknown', 'partial', 'deploymentPartial'],
        [99, 'Succeeded', 'unknown', 'unknown', 'deploymentStatusUnavailable']
    ] as const) {
        test(`observed Kudu status ${status} preserves legacy behavior and honest normalized status`, async () => {
            mock.method(client, 'getDeployResult', () => Promise.resolve({ id: 'private-id', status }));
            await callWithTelemetryAndErrorHandling('root', async context => {
                initialize(context);
                await waitForDeploymentToComplete(context, site, { pollingInterval: 0 });
            });
            const event = rootEvent();
            assert.strictEqual(event.properties.result, legacyResult);
            assert.strictEqual(event.properties.outcome, outcome);
            assert.strictEqual(event.properties.deploymentStatus, deploymentStatus);
            assert.strictEqual(event.properties.failureCode, code);
            const completion = events.find(e => e.properties.stage === 'completion');
            assert.ok(completion);
            assert.strictEqual(completion.properties.deploymentStatus, deploymentStatus);
            assert.doesNotMatch(JSON.stringify(events.filter(e => e.name === 'workflowStage')), /private/);
        });
    }

    test('running status and temporary terminal status are not completed success', () => {
        assert.deepStrictEqual(getDeploymentStatusDetails(0), { deploymentStatus: 'running' });
        assert.deepStrictEqual(getDeploymentStatusDetails(2), { deploymentStatus: 'running' });
        assert.strictEqual(getDeploymentStatusDetails(4, true).deploymentStatus, 'failed');
        assert.strictEqual(getDeploymentStatusDetails(undefined).deploymentStatus, 'unknown');
    });

    test('normal polling iterations are not retries', async () => {
        let polls = 0;
        mock.method(client, 'getDeployResult', () => Promise.resolve({ id: 'private', status: [0, 2, 4][polls++] }));
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await waitForDeploymentToComplete(context, site, { pollingInterval: 0 });
        });
        assert.strictEqual(polls, 3);
        assert.strictEqual(rootEvent().measurements.retryCount, 0);
        assert.strictEqual(rootEvent().properties.recoveredAfterRetry, undefined);
    });

    test('canceled polling return is not normalized success', async () => {
        const token = new vscode.CancellationTokenSource();
        token.cancel();
        try {
            await callWithTelemetryAndErrorHandling('root', async context => {
                initialize(context);
                await waitForDeploymentToComplete(context, site, { token: token.token });
            });
        } finally {
            token.dispose();
        }
        assert.strictEqual(rootEvent().properties.result, 'Succeeded');
        assert.strictEqual(rootEvent().properties.outcome, 'canceled');
        assert.strictEqual(rootEvent().properties.cancelReason, 'unknown');
    });

    test('an internally canceled concurrent poller cannot override an upload failure as user cancellation', async () => {
        const token = new vscode.CancellationTokenSource();
        token.cancel();
        try {
            await callWithTelemetryAndErrorHandling('root', async context => {
                initialize(context);
                await waitForDeploymentToComplete(context, site, { token: token.token, internalCancellation: true });
                throw new Error('private upload failure');
            });
        } finally {
            token.dispose();
        }
        assert.strictEqual(rootEvent().properties.result, 'Failed');
        assert.strictEqual(rootEvent().properties.outcome, 'failed');
        assert.strictEqual(rootEvent().properties.cancelReason, undefined);
        assert.strictEqual(events.find(e => e.properties.stage === 'polling')?.properties.outcome, 'canceled');
    });

    for (const method of ['getLogEntry', 'getLogEntryDetails'] as const) {
        test(`observed Azure completion survives a later ${method} command failure`, async () => {
            mock.method(client, 'getDeployResult', () => Promise.resolve({ id: 'private-id', status: 4 }));
            if (method === 'getLogEntryDetails') {
                mock.method(client, 'getLogEntry', () => Promise.resolve([{
                    id: 'private-log', detailsUrl: 'https://private.example/log', message: 'private-log', logTime: new Date()
                }]));
            }
            mock.method(client, method, () => Promise.reject(Object.assign(new Error('private log retrieval failure'), { code: 'ECONNRESET' })));
            await callWithTelemetryAndErrorHandling('root', async context => {
                initialize(context);
                await waitForDeploymentToComplete(context, site, { pollingInterval: 0 });
            });
            assert.strictEqual(rootEvent().properties.result, 'Failed');
            assert.strictEqual(rootEvent().properties.outcome, 'failed');
            assert.strictEqual(rootEvent().properties.deploymentStatus, 'succeeded');
            assert.strictEqual(rootEvent().properties.networkCategory, 'connection');
            assert.strictEqual(rootEvent().measurements.retryCount, 4);
            const completion = events.find(e => e.properties.stage === 'completion');
            assert.ok(completion);
            assert.strictEqual(completion.properties.outcome, 'succeeded');
            assert.strictEqual(completion.properties.deploymentStatus, 'succeeded');
            assert.strictEqual(events.find(e => e.properties.stage === 'polling' && e.properties.outcome === 'failed')?.properties.outcome, 'failed');
            assert.doesNotMatch(JSON.stringify(events.filter(e => e.name === 'workflowStage')), /private/);
        }).timeout(25000);
    }

    test('Kudu retries count actual invocations and recovered success', async () => {
        let invocations = 0;
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            const value = await retryKuduCall(context, 'getResult', () => ++invocations === 1 ? Promise.reject(new Error('private')) : Promise.resolve('ok'));
            assert.strictEqual(value, 'ok');
        });
        assert.strictEqual(invocations, 2);
        assert.strictEqual(rootEvent().measurements.retryCount, 1);
        assert.strictEqual(rootEvent().properties.recoveredAfterRetry, 'true');
        assert.strictEqual(rootEvent().measurements.kuduMaxRetry, 2);
    });

    test('trigger sync keeps its existing retry policy and reports actual recovery', async () => {
        let invocations = 0;
        mock.method(client, 'syncFunctionTriggers', () => ++invocations === 1 ? Promise.reject(new Error('private')) : Promise.resolve());
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await syncTriggersPostDeploy(context, site);
        });
        assert.strictEqual(invocations, 2);
        assert.strictEqual(rootEvent().measurements.retryCount, 1);
        assert.strictEqual(rootEvent().properties.recoveredAfterRetry, 'true');
        assert.strictEqual(rootEvent().properties.outcome, 'succeeded');
    }).timeout(25000);

    for (const choice of ['cancel', 'openSettings', 'deployAnyway'] as const) {
        test(`failed task dialog ${choice} is distinct from initial dismissal`, async () => {
            mock.method(vscode.window, 'showErrorMessage', (_message: string, _options: vscode.MessageOptions, ...items: vscode.MessageItem[]) => Promise.resolve(choice === 'deployAnyway' ? items[0] : choice === 'openSettings' ? items[1] : undefined));
            mock.method(vscode.commands, 'executeCommand', () => Promise.resolve());
            await callWithTelemetryAndErrorHandling('root', async context => {
                initialize(context);
                await handleFailedPreDeployTask(context, { taskName: 'private-task', exitCode: 1, failedToFindTask: false });
            });
            assert.strictEqual(rootEvent().properties.outcome, choice === 'deployAnyway' ? 'succeeded' : 'failed');
            assert.strictEqual(rootEvent().properties.result, choice === 'deployAnyway' ? 'Succeeded' : 'Canceled');
            assert.strictEqual(rootEvent().properties.failureCode, choice === 'deployAnyway' ? undefined : 'preDeployTaskFailed');
            assert.notStrictEqual(rootEvent().properties.cancelReason, 'userDismissed');
        });
    }

    function configureTask(): void {
        mock.method(vscode.workspace, 'getConfiguration', () => ({
            get: <T>(): T => 'build' as T, has: () => true, inspect: () => undefined, update: () => Promise.resolve()
        }));
    }

    for (const state of ['launched', 'alreadyActive', 'launchFailed'] as const) {
        test(`post-deploy task ${state} does not imply observed task-process success`, async () => {
            configureTask();
            const task = new vscode.Task({ type: 'shell' }, vscode.TaskScope.Workspace, 'build', 'test');
            const execution: vscode.TaskExecution = { task, terminate: (): void => { /* fixture */ } };
            let invocations = 0;
            mock.method(taskUtils, 'findTask', () => Promise.resolve(task));
            mock.getter(vscode.tasks, 'taskExecutions', () => state === 'alreadyActive' ? [execution] : []);
            mock.method(vscode.tasks, 'executeTask', () => {
                invocations++;
                return state === 'launchFailed' ? Promise.reject(new Error('private launch failure')) : Promise.resolve(execution);
            });
            await callWithTelemetryAndErrorHandling('root', async context => {
                initialize(context);
                const deploy = Object.assign(deployContext(context), { fsPath: 'C:\\private', site, client, aspPromise: Promise.resolve(undefined) });
                await new PostDeployTaskExecuteStep({}).execute(deploy, { report: (): void => { /* fixture */ } });
            });
            const stage = events.find(e => e.properties.stage === 'postDeployTask');
            assert.ok(stage);
            assert.strictEqual(stage.properties.outcome, state === 'launchFailed' ? 'failed' : 'unknown');
            assert.strictEqual(rootEvent().properties.result, state === 'launchFailed' ? 'Failed' : 'Succeeded');
            assert.strictEqual(invocations, state === 'alreadyActive' ? 0 : 1);
            assert.doesNotMatch(JSON.stringify(stage), /private/);
        });
    }

    test('a failed task stage followed by Deploy Anyway does not prematurely fail the workflow', async () => {
        configureTask();
        const task = new vscode.Task({ type: 'shell' }, vscode.TaskScope.Workspace, 'build', 'test');
        const execution: vscode.TaskExecution = { task, terminate: (): void => { /* fixture */ } };
        const ended = new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
        mock.method(taskUtils, 'findTask', () => Promise.resolve(task));
        mock.method(vscode.tasks, 'onDidEndTaskProcess', ended.event);
        mock.getter(vscode.tasks, 'taskExecutions', () => []);
        mock.method(vscode.tasks, 'executeTask', () => {
            setTimeout(() => ended.fire({ execution, exitCode: 1 }), 0);
            return Promise.resolve(execution);
        });
        mock.method(vscode.window, 'showErrorMessage', (_message: string, _options: vscode.MessageOptions, ...items: vscode.MessageItem[]) => Promise.resolve(items[0]));
        try {
            await callWithTelemetryAndErrorHandling('root', async context => {
                initialize(context);
                await runPreDeployTask(deployContext(context), 'C:\\private', undefined);
            });
        } finally {
            ended.dispose();
        }
        assert.strictEqual(events.find(e => e.properties.stage === 'preDeployTask')?.properties.outcome, 'failed');
        assert.strictEqual(rootEvent().properties.outcome, 'succeeded');
        assert.strictEqual(rootEvent().properties.failureCode, undefined);
        assert.strictEqual(rootEvent().measurements.retryCount, undefined);
    });

    test('missing task is a blocked prerequisite rather than successful task execution', async () => {
        configureTask();
        mock.method(taskUtils, 'findTask', () => Promise.resolve(undefined));
        await callWithTelemetryAndErrorHandling('root', async context => {
            initialize(context);
            await runPreDeployTask(deployContext(context), 'C:\\private', undefined);
        });
        assert.strictEqual(rootEvent().properties.outcome, 'blocked');
        assert.strictEqual(rootEvent().properties.failureCode, 'preDeployTaskMissing');
        assert.strictEqual(rootEvent().properties.result, 'Failed');
    });

    for (const secondInvocation of ['succeeded', 'missing', 'alreadyActive', 'skipped', 'launchFailed'] as const) {
        test(`native-dependency task retry ${secondInvocation} counts only observed launch invocations`, async () => {
            configureTask();
            const task = new vscode.Task({ type: 'shell' }, vscode.TaskScope.Workspace, 'build', 'test');
            const execution: vscode.TaskExecution = { task, terminate: (): void => { /* fixture */ } };
            const ended = new vscode.EventEmitter<vscode.TaskProcessEndEvent>();
            let exitCode = 1;
            let launches = 0;
            let repeating = false;
            mock.method(taskUtils, 'findTask', () => Promise.resolve(repeating && secondInvocation === 'missing' ? undefined : task));
            mock.method(vscode.tasks, 'onDidEndTaskProcess', ended.event);
            mock.getter(vscode.tasks, 'taskExecutions', () => repeating && secondInvocation === 'alreadyActive' ? [execution] : []);
            mock.method(vscode.tasks, 'executeTask', () => {
                launches++;
                if (repeating && secondInvocation === 'launchFailed') {
                    return Promise.reject(new Error('private task launch failure'));
                }
                setTimeout(() => ended.fire({ execution, exitCode }), 0);
                return Promise.resolve(execution);
            });
            try {
                await callWithTelemetryAndErrorHandling('root', async context => {
                    initialize(context);
                    const deploy = deployContext(context);
                    assert.strictEqual((await tryRunPreDeployTask(deploy, 'C:\\private', undefined)).exitCode, 1);
                    repeating = true;
                    exitCode = 0;
                    if (secondInvocation === 'alreadyActive') {
                        setTimeout(() => ended.fire({ execution, exitCode }), 0);
                    }
                    if (secondInvocation === 'skipped') {
                        deploy.deployMethod = undefined;
                    }
                    const second = await tryRunPreDeployTask(deploy, 'C:\\private', secondInvocation === 'skipped' ? ScmType.LocalGit : undefined, { isRetry: true });
                    assert.strictEqual(second.failedToFindTask, secondInvocation === 'missing');
                    assert.strictEqual(second.exitCode, secondInvocation === 'succeeded' || secondInvocation === 'alreadyActive' ? 0 : undefined);
                    await withTelemetryStage(context, { stage: 'upload' }, () => Promise.resolve());
                });
            } finally {
                ended.dispose();
            }
            const observedRetry = secondInvocation === 'succeeded' || secondInvocation === 'launchFailed';
            assert.strictEqual(launches, observedRetry ? 2 : 1);
            assert.strictEqual(rootEvent().properties.outcome, secondInvocation === 'launchFailed' ? 'failed' : 'succeeded');
            assert.strictEqual(rootEvent().measurements.retryCount, observedRetry ? 1 : undefined);
            assert.strictEqual(rootEvent().properties.recoveredAfterRetry, secondInvocation === 'succeeded' ? 'true' : secondInvocation === 'launchFailed' ? 'false' : undefined);
            const taskStages = events.filter(e => e.properties.stage === 'preDeployTask');
            assert.strictEqual(taskStages.length, 2);
            assert.strictEqual(taskStages[0].properties.outcome, 'failed');
            assert.strictEqual(taskStages[1].properties.outcome, secondInvocation === 'missing' ? 'blocked' : secondInvocation === 'skipped' ? 'unknown' : secondInvocation === 'launchFailed' ? 'failed' : 'succeeded');
            assert.strictEqual(taskStages[1].properties.recoveredAfterRetry, secondInvocation === 'succeeded' ? 'true' : undefined);
        });
    }
});
