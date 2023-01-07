/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deployment } from '@azure/arm-appservice';
import { sendRequestWithTimeout } from '@microsoft/vscode-azext-azureutils';
import { IActionContext, IParsedError, nonNullProp, nonNullValue, parseError } from '@microsoft/vscode-azext-utils';
import { CancellationToken, window } from 'vscode';
import type { KuduModels } from 'vscode-azurekudu';
import { ParsedSite, SiteClient } from '../SiteClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { delay } from '../utils/delay';
import { ignore404Error, retryKuduCall } from '../utils/kuduUtils';
import { IDeployContext } from './IDeployContext';

type DeploymentOptions = {
    expectedId?: string,
    token?: CancellationToken,
    pollingInterval?: number,
    locationUrl?: string
}

export async function waitForDeploymentToComplete(context: IActionContext & Partial<IDeployContext>, site: ParsedSite, options: DeploymentOptions = {}): Promise<void> {
    let fullLog: string = '';

    let lastLogTime: Date = new Date(0);
    let lastErrorLine: string = '';
    let initialStartTime: Date | undefined;
    let deployment: KuduModels.DeployResult | undefined;
    let permanentId: string | undefined;
    // a 60 second timeout period to let Kudu initialize the deployment
    const maxTimeToWaitForExpectedId: number = Date.now() + 60 * 1000;
    const client = await site.createClient(context);

    const { expectedId, token, locationUrl } = options;
    const pollingInterval = options.pollingInterval ?? 5000;

    while (!token?.isCancellationRequested) {
        if (locationUrl) {
            try {
                // request can occasionally take more than 10 seconds
                deployment = (await sendRequestWithTimeout(context, { method: 'GET', url: locationUrl }, 10 * 1000, site.subscription)).parsedBody as KuduModels.DeployResult;
            } catch (error: unknown) {
                const parsedError = parseError(error);
                if (parsedError.errorType !== 'REQUEST_ABORTED_ERROR') {
                    throw parsedError;
                }
            }
        } else {
            [deployment, permanentId, initialStartTime] = await tryGetLatestDeployment(context, client, permanentId, initialStartTime, expectedId);
        }

        if ((deployment === undefined || !deployment.id)) {
            if ((expectedId || locationUrl) && Date.now() < maxTimeToWaitForExpectedId) {
                await delay(pollingInterval);
                continue;
            }

            throw new Error(localize('failedToFindDeployment', 'Failed to get status of deployment.'));
        }

        const deploymentId: string = deployment.id;
        let logEntries: KuduModels.LogEntry[] = [];
        await retryKuduCall(context, 'getLogEntry', async () => {
            await ignore404Error(context, async () => {
                logEntries = (await client.getLogEntry(context, deploymentId)).reverse();
            });
        });

        let lastLogTimeForThisPoll: Date | undefined;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const newEntry: KuduModels.LogEntry | undefined = logEntries.pop();
            if (!newEntry) {
                break;
            }

            if (newEntry.message && newEntry.logTime && newEntry.logTime > lastLogTime) {
                fullLog = fullLog.concat(newEntry.message);
                ext.outputChannel.appendLog(newEntry.message, { date: newEntry.logTime, resourceName: site.fullName });
                lastLogTimeForThisPoll = newEntry.logTime;
                if (/error/i.test(newEntry.message)) {
                    lastErrorLine = newEntry.message;
                }
            }

            await retryKuduCall(context, 'getLogEntryDetails', async () => {
                await ignore404Error(context, async () => {
                    if (newEntry.id && newEntry.detailsUrl) {
                        const details: KuduModels.LogEntry[] = await client.getLogEntryDetails(context, deploymentId, newEntry.id);
                        logEntries.push(...cleanDetails(details));
                    }
                });
            });
        }

        if (lastLogTimeForThisPoll) {
            lastLogTime = lastLogTimeForThisPoll;
        }

        if (deployment.complete) {
            if (deployment.status === 3 /* Failed */ || deployment.isTemp) { // If the deployment completed without making it to the "permanent" phase, it must have failed
                const message: string = localize('deploymentFailed', 'Deployment to "{0}" failed.', site.fullName);
                const viewOutput: string = localize('viewOutput', 'View Output');
                // don't wait
                void window.showErrorMessage(message, viewOutput).then(result => {
                    if (result === viewOutput) {
                        ext.outputChannel.show();
                    }
                });

                const messageWithoutName: string = localize('deploymentFailedWithoutName', 'Deployment failed.');
                ext.outputChannel.appendLog(messageWithoutName, { resourceName: site.fullName });
                context.errorHandling.suppressDisplay = true;
                // Hopefully the last line is enough to give us an idea why deployments are failing without excessively tracking everything
                context.telemetry.properties.deployErrorLastLine = lastErrorLine;
                throw new Error(messageWithoutName);
            } else {
                context.syncTriggersPostDeploy = site.isFunctionApp && !/syncing/i.test(fullLog) && !site.isKubernetesApp && !site.isWorkflowApp;
                return;
            }
        } else {
            await delay(pollingInterval);
        }
    }
}

async function tryGetLatestDeployment(context: IActionContext, client: SiteClient, permanentId: string | undefined, initialStartTime: Date | undefined, expectedId?: string): Promise<[KuduModels.DeployResult | undefined, string | undefined, Date | undefined]> {
    let deployment: KuduModels.DeployResult | undefined;

    if (permanentId) {
        // Use "permanentId" to find the deployment during its "permanent" phase
        deployment = await retryKuduCall(context, 'getResult', async () => {
            return await client.getDeployResult(context, nonNullValue(permanentId));
        });
    } else if (expectedId) {
        // if we have a "expectedId" we know which deployment we are looking for, so wait until latest id reflects that
        try {
            const latestDeployment: KuduModels.DeployResult = await retryKuduCall(context, 'getResult', async () => {
                return await client.getDeployResult(context, 'latest');
            });
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
        const deployments: Deployment[] = await retryKuduCall(context, 'getDeployResults', async () => {
            return await client.getDeployResults(context);
        });
        deployment = deployments
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .filter(deployResult => deployResult.startTime && deployResult.startTime >= initialStartTime!)
            .sort((a, b) => nonNullProp(b, 'startTime').valueOf() - nonNullProp(a, 'startTime').valueOf())
            .shift();
        if (deployment && !deployment.isTemp) {
            // Make note of the id once the deplyoment has shifted to the "permanent" phase, so that we can use that to find the deployment going forward
            permanentId = deployment.id;
        }
    } else {
        // Use "latest" to get the deployment before we know the "initialReceivedTime" or "permanentId"
        try {
            deployment = await retryKuduCall(context, 'getResult', async () => {
                return await client.getDeployResult(context, 'latest');
            });
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

/**
 * Workaround for some weird Oryx behavior where it shows several duplicate logs on a single line
 */
function cleanDetails(entries: KuduModels.LogEntry[]): KuduModels.LogEntry[] {
    const result: KuduModels.LogEntry[] = [];
    for (const entry of entries) {
        const oryxEOL: string = '\\n';
        if (entry.message?.includes(oryxEOL)) {
            const newMessages: string[] = entry.message.split(oryxEOL);
            for (const newMessage of newMessages) {
                if (!entries.find(d => d.message === newMessage)) {
                    result.push({ ...entry, message: newMessage });
                }
            }
        } else {
            result.push(entry);
        }
    }
    return result.reverse();
}
