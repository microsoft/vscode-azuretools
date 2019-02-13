/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import KuduClient from 'vscode-azurekudu';
import { DeployResult, LogEntry } from 'vscode-azurekudu/lib/models';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { nonNullProp } from '../utils/nonNull';
import { formatDeployLog } from './formatDeployLog';

export async function waitForDeploymentToComplete(client: SiteClient, kuduClient: KuduClient, permanentId?: string, pollingInterval: number = 5000): Promise<void> {
    const alreadyDisplayedLogs: string[] = [];
    let nextTimeToDisplayWaitingLog: number = Date.now();
    let initialStartTime: Date | undefined;
    let deployment: DeployResult | undefined;
    let kuduTimeout: NodeJS.Timer | undefined;

    // tslint:disable-next-line:no-constant-condition
    while (true) {
        [deployment, permanentId, initialStartTime] = await getLatestDeployment(kuduClient, permanentId, initialStartTime);
        if ((deployment === undefined || !deployment.id)) {
            if (permanentId) {
                // if we passed an id keep polling so that the latest deployment matches that id
                if (kuduTimeout === undefined) {
                    const timeout: string = localize('redeployTimeout', 'Deployment "{0}" was unable to resolve and has timed out.', permanentId);
                    // a 20 second timeout period to let Kudu initialize the deployment
                    kuduTimeout = setTimeout(() => { throw new Error(timeout) }, pollingInterval * 2);
                }
                await new Promise((resolve: () => void): void => { setTimeout(resolve, pollingInterval); });
                continue;
            }
            throw new Error(localize('failedToFindDeployment', 'Failed to get status of deployment.'));
        }

        let logEntries: LogEntry[] = [];
        if (kuduTimeout) {
            clearTimeout(kuduTimeout);
        }
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
            await new Promise((resolve: () => void): void => { setTimeout(resolve, pollingInterval); });
        }
    }
}

async function getLatestDeployment(kuduClient: KuduClient, permanentId: string | undefined, initialStartTime: Date | undefined): Promise<[DeployResult | undefined, string | undefined, Date | undefined]> {
    let deployment: DeployResult | undefined;
    if (permanentId) {
        // Use "permanentId" to find the deployment during its "permanent" phase
        // if we have a "permanentId" we know which deployment we are looking for, so wait until latest id reflects that
        const latestDeployment: DeployResult = await kuduClient.deployment.getResult('latest');
        deployment = latestDeployment.id === permanentId ? latestDeployment : undefined;
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
        deployment = <DeployResult | undefined>await kuduClient.deployment.getResult('latest');
        if (deployment && deployment.startTime) {
            // Make note of the startTime because that is when kudu has began the deployment process,
            // so that we can use that to find the deployment going forward
            initialStartTime = deployment.startTime;
        }
    }

    return [deployment, permanentId, initialStartTime];
}

// async function waitForDeploymentToStart(kuduClient: KuduClient, id: string): Promise<void> {
//     let getResultInterval: NodeJS.Timer | undefined;
//     try {
//         await new Promise((resolve: () => void, reject: (error: Error) => void): void => {
//             kuduClient.deployment.deploy(id).catch(reject);
//             getResultInterval = setInterval(
//                 async () => {
//                     const deployResult: DeployResult | undefined = <DeployResult | undefined>await kuduClient.deployment.getResult('latest');
//                     if (deployResult && deployResult.id === id) {
//                         resolve();
//                     }
//                 },
//                 3000
//             );
//             const timeout: string = localize('redeployTimeout', 'Deployment "{0}" was unable to resolve and has timed out.', id);
//             // a 20 second timeout period to let Kudu initialize the deployment
//             setTimeout(() => reject(new Error(timeout)), 20000);
//         });
//     } finally {
//         if (getResultInterval) {
//             clearInterval(getResultInterval);
//         }
//     }
// }
