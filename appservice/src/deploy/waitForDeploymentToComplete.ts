/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as retry from 'p-retry';
import { CancellationToken } from 'vscode';
import { IActionContext, IParsedError, parseError } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { DeployResult, LogEntry } from 'vscode-azurekudu/lib/models';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { delay } from '../utils/delay';
import { nonNullProp } from '../utils/nonNull';

// We get a lot of errors reported for deploy (e.g. InternalServerError), but it's possible that's just from listing the logs (which has a lot of calls to kudu), not actually a deploy failure
// Thus we will retry a few times with exponential backoff. Each "set" of retries will take a max of about 15 seconds
const retryOptions: retry.Options = { retries: 4, minTimeout: 1000 };

export async function waitForDeploymentToComplete(context: IActionContext, client: SiteClient, expectedId?: string, token?: CancellationToken, pollingInterval: number = 5000): Promise<string> {
    let fullLog: string = '';

    const alreadyDisplayedLogs: string[] = [];
    let nextTimeToDisplayWaitingLog: number = Date.now();
    let initialStartTime: Date | undefined;
    let deployment: DeployResult | undefined;
    let permanentId: string | undefined;
    // a 60 second timeout period to let Kudu initialize the deployment
    const maxTimeToWaitForExpectedId: number = Date.now() + 60 * 1000;
    const kuduClient: KuduClient = await client.getKuduClient();

    while (!token || !token.isCancellationRequested) {
        [deployment, permanentId, initialStartTime] = await tryGetLatestDeployment(context, kuduClient, permanentId, initialStartTime, expectedId);
        if ((deployment === undefined || !deployment.id)) {
            if (expectedId && Date.now() < maxTimeToWaitForExpectedId) {
                await delay(pollingInterval);
                continue;
            }

            throw new Error(localize('failedToFindDeployment', 'Failed to get status of deployment.'));
        }
        let logEntries: LogEntry[] = [];
        try {
            logEntries = await retry(
                async (attempt: number) => {
                    addAttemptTelemetry(context, 'getLogEntry', attempt);
                    // tslint:disable-next-line: no-non-null-assertion
                    return <LogEntry[]>await kuduClient.deployment.getLogEntry(deployment!.id!);
                },
                retryOptions
            );
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            // Swallow 404 errors for a deployment while its still in the "temp" phase
            // (We can't reliably get logs until the deployment has shifted to the "permanent" phase)
            if (!deployment.isTemp || parsedError.errorType !== '404') {
                throw error;
            }
        }

        const newLogEntries: LogEntry[] = logEntries.filter((newEntry: LogEntry) => !alreadyDisplayedLogs.some((oldId: string) => newEntry.id === oldId));
        if (newLogEntries.length === 0) {
            if (Date.now() > nextTimeToDisplayWaitingLog) {
                ext.outputChannel.appendLog(localize('waitingForComand', 'Waiting for long running command to finish...'), { resourceName: client.fullName });
                nextTimeToDisplayWaitingLog = Date.now() + 60 * 1000;
            }
        } else {
            for (const newEntry of newLogEntries) {
                if (newEntry.id) {
                    alreadyDisplayedLogs.push(newEntry.id);
                    if (newEntry.message) {
                        fullLog = fullLog.concat(newEntry.message);
                        ext.outputChannel.appendLog(newEntry.message, { date: newEntry.logTime, resourceName: client.fullName });
                    }

                    if (newEntry.detailsUrl) {
                        const entryDetails: LogEntry[] =
                            logEntries = await retry(
                                async (attempt: number) => {
                                    addAttemptTelemetry(context, 'getLogEntryDetails', attempt);
                                    // tslint:disable-next-line: no-non-null-assertion
                                    return await kuduClient.deployment.getLogEntryDetails(deployment!.id!, newEntry.id!);
                                },
                                retryOptions
                            );
                        for (const entryDetail of entryDetails) {
                            if (entryDetail.message) {
                                fullLog = fullLog.concat(entryDetail.message);
                                ext.outputChannel.appendLog(entryDetail.message, { date: entryDetail.logTime, resourceName: client.fullName });
                            }
                        }
                    }
                }
            }
        }

        if (deployment.complete) {
            if (deployment.isTemp) {
                // If the deployment completed without making it to the "permanent" phase, it must have failed
                throw new Error(localize('deploymentFailed', 'Deployment to "{0}" failed. See output channel for more details.', client.fullName));
            } else {
                return fullLog;
            }
        } else {
            await delay(pollingInterval);
        }
    }

    return fullLog;
}

async function tryGetLatestDeployment(context: IActionContext, kuduClient: KuduClient, permanentId: string | undefined, initialStartTime: Date | undefined, expectedId?: string): Promise<[DeployResult | undefined, string | undefined, Date | undefined]> {
    let deployment: DeployResult | undefined;

    if (permanentId) {
        // Use "permanentId" to find the deployment during its "permanent" phase
        deployment = await retry(
            async (attempt: number) => {
                addAttemptTelemetry(context, 'getResult', attempt);
                // tslint:disable-next-line: no-non-null-assertion
                return await kuduClient.deployment.getResult(permanentId!);
            },
            retryOptions
        );
    } else if (expectedId) {
        // if we have a "expectedId" we know which deployment we are looking for, so wait until latest id reflects that
        try {
            const latestDeployment: DeployResult = await retry(
                async (attempt: number) => {
                    addAttemptTelemetry(context, 'getResult', attempt);
                    return await kuduClient.deployment.getResult('latest');
                },
                retryOptions
            );
            // if the latest deployment is temp, then a deployment has triggered so we should watch it even if it doesn't match the expectedId
            if (latestDeployment.isTemp) {
                deployment = latestDeployment;
            } else if (latestDeployment.id === expectedId) {
                deployment = latestDeployment;
                permanentId = latestDeployment.id;
            }
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            // swallow 404 error since "latest" might not exist on the first deployment
            if (parsedError.errorType !== '404') {
                throw parsedError;
            }
        }
    } else if (initialStartTime) {
        // Use "initialReceivedTime" to find the deployment during its "temp" phase
        const deployments: DeployResult[] = await retry(
            async (attempt: number) => {
                addAttemptTelemetry(context, 'getDeployResults', attempt);
                return await kuduClient.deployment.getDeployResults();
            },
            retryOptions
        );
        deployment = deployments
            // tslint:disable-next-line:no-non-null-assertion
            .filter((deployResult: DeployResult) => deployResult.startTime && deployResult.startTime >= initialStartTime!)
            .sort((a: DeployResult, b: DeployResult) => nonNullProp(b, 'startTime').valueOf() - nonNullProp(a, 'startTime').valueOf())
            .shift();
        if (deployment && !deployment.isTemp) {
            // Make note of the id once the deplyoment has shifted to the "permanent" phase, so that we can use that to find the deployment going forward
            permanentId = deployment.id;
        }
    } else {
        // Use "latest" to get the deployment before we know the "initialReceivedTime" or "permanentId"
        try {
            deployment = await retry(
                async (attempt: number) => {
                    addAttemptTelemetry(context, 'getResult', attempt);
                    return <DeployResult | undefined>await kuduClient.deployment.getResult('latest');
                },
                retryOptions
            );
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            // swallow 404 error since "latest" might not exist on the first deployment
            if (parsedError.errorType !== '404') {
                throw error;
            }
        }
        if (deployment && deployment.startTime) {
            // Make note of the startTime because that is when kudu has began the deployment process,
            // so that we can use that to find the deployment going forward
            initialStartTime = deployment.startTime;
        }
    }

    return [deployment, permanentId, initialStartTime];
}

function addAttemptTelemetry(context: IActionContext, methodName: string, attempt: number): void {
    const key: string = methodName + 'MaxAttempt';
    const existingValue: number | undefined = context.telemetry.measurements[key];
    if (existingValue === undefined || existingValue < attempt) {
        context.telemetry.measurements[key] = attempt;
    }
}
