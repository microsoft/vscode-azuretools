/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import KuduClient from 'vscode-azurekudu';
import { DeployResult, LogEntry } from 'vscode-azurekudu/lib/models';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { delay } from '../utils/delay';
import { nonNullProp } from '../utils/nonNull';
import { formatDeployLog } from './formatDeployLog';

export async function waitForDeploymentToComplete(client: SiteClient, kuduClient: KuduClient, expectedId?: string, pollingInterval: number = 5000): Promise<void> {
    const alreadyDisplayedLogs: string[] = [];
    let nextTimeToDisplayWaitingLog: number = Date.now();
    let initialStartTime: Date | undefined;
    let deployment: DeployResult | undefined;
    let permanentId: string | undefined;
    // a 30 second timeout period to let Kudu initialize the deployment
    const maxTimeToWaitForExpectedId: number = Date.now() + 30 * 1000;

    // tslint:disable-next-line:no-constant-condition
    while (true) {
        [deployment, permanentId, initialStartTime] = await tryGetLatestDeployment(kuduClient, permanentId, initialStartTime, expectedId);
        if ((deployment === undefined || !deployment.id)) {
            if (expectedId && Date.now() < maxTimeToWaitForExpectedId) {
                ext.outputChannel.appendLine(formatDeployLog(client, localize('waitingForBuild', 'Waiting for build to trigger...')));
                await delay(pollingInterval);
                continue;
            }

            throw new Error(localize('failedToFindDeployment', 'Failed to get status of deployment.'));
        }
        let logEntries: LogEntry[] = [];
        try {
            logEntries = <LogEntry[]>await kuduClient.deployment.getLogEntry(deployment.id);
        } catch (error) {
            // Swallow 404 errors for a deployment while its still in the "temp" phase
            // (We can't reliably get logs until the deployment has shifted to the "permanent" phase)
            // tslint:disable-next-line:no-unsafe-any
            if (!deployment.isTemp || !error || error.statusCode !== 404) {
                throw error;
            }
        }

        const newLogEntries: LogEntry[] = logEntries.filter((newEntry: LogEntry) => !alreadyDisplayedLogs.some((oldId: string) => newEntry.id === oldId));
        if (newLogEntries.length === 0) {
            if (Date.now() > nextTimeToDisplayWaitingLog) {
                ext.outputChannel.appendLine(formatDeployLog(client, localize('waitingForComand', 'Waiting for long running command to finish...')));
                nextTimeToDisplayWaitingLog = Date.now() + 60 * 1000;
            }
        } else {
            for (const newEntry of newLogEntries) {
                if (newEntry.id) {
                    alreadyDisplayedLogs.push(newEntry.id);
                    if (newEntry.message) {
                        ext.outputChannel.appendLine(formatDeployLog(client, newEntry.message, newEntry.logTime));
                    }

                    if (newEntry.detailsUrl) {
                        const entryDetails: LogEntry[] = await kuduClient.deployment.getLogEntryDetails(deployment.id, newEntry.id);
                        for (const entryDetail of entryDetails) {
                            if (entryDetail.message) {
                                ext.outputChannel.appendLine(formatDeployLog(client, entryDetail.message, entryDetail.logTime));
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
                return;
            }
        } else {
            await delay(pollingInterval);
        }
    }
}

async function tryGetLatestDeployment(kuduClient: KuduClient, permanentId: string | undefined, initialStartTime: Date | undefined, expectedId?: string): Promise<[DeployResult | undefined, string | undefined, Date | undefined]> {
    let deployment: DeployResult | undefined;

    if (permanentId) {
            // Use "permanentId" to find the deployment during its "permanent" phase
            deployment = await kuduClient.deployment.getResult(permanentId);
        } else if (expectedId) {
            // if we have a "expectedId" we know which deployment we are looking for, so wait until latest id reflects that
            try {
                const latestDeployment: DeployResult = await kuduClient.deployment.getResult('latest');
                [deployment, permanentId] = latestDeployment.id === expectedId ? [latestDeployment, latestDeployment.id] : [undefined, undefined];
            } catch (error) {
                // swallow 404 error since "latest" might not exist on the first deployment
                if (error.statusCode !== 404) {
                    // tslint:disable-next-line:no-unsafe-any
                    throw error;
                }
            }
        } else if (initialStartTime) {
            // Use "initialReceivedTime" to find the deployment during its "temp" phase
            deployment = (await kuduClient.deployment.getDeployResults())
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
                deployment = <DeployResult | undefined>await kuduClient.deployment.getResult('latest');
            } catch (error) {
                // swallow 404 error since "latest" might not exist on the first deployment
                if (error.statusCode !== 404) {
                    // tslint:disable-next-line:no-unsafe-any
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
