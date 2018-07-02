/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import KuduClient from 'vscode-azurekudu';
import { DeployResult, LogEntry } from 'vscode-azurekudu/lib/models';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { formatDeployLog } from './formatDeployLog';

export async function waitForDeploymentToComplete(client: SiteClient, kuduClient: KuduClient, outputChannel: vscode.OutputChannel, pollingInterval: number = 5000): Promise<void> {
    const alreadyDisplayedLogs: string[] = [];
    let nextTimeToDisplayWaitingLog: number = Date.now();
    let permanentId: string | undefined;
    let initialReceivedTime: Date | undefined;
    let deployment: DeployResult | undefined;

    // tslint:disable-next-line:no-constant-condition
    while (true) {
        [deployment, permanentId, initialReceivedTime] = await getLatestDeployment(kuduClient, permanentId, initialReceivedTime);

        if (deployment === undefined || !deployment.id) {
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
                outputChannel.appendLine(formatDeployLog(client, localize('waitingForComand', 'Waiting for long running command to finish...')));
                nextTimeToDisplayWaitingLog = Date.now() + 60 * 1000;
            }
        } else {
            for (const newEntry of newLogEntries) {
                if (newEntry.id) {
                    alreadyDisplayedLogs.push(newEntry.id);
                    if (newEntry.message) {
                        outputChannel.appendLine(formatDeployLog(client, newEntry.message, newEntry.logTime));
                    }

                    if (newEntry.detailsUrl) {
                        const entryDetails: LogEntry[] = await kuduClient.deployment.getLogEntryDetails(deployment.id, newEntry.id);
                        for (const entryDetail of entryDetails) {
                            if (entryDetail.message) {
                                outputChannel.appendLine(formatDeployLog(client, entryDetail.message, entryDetail.logTime));
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

async function getLatestDeployment(kuduClient: KuduClient, permanentId: string | undefined, initialReceivedTime: Date | undefined): Promise<[DeployResult | undefined, string | undefined, Date | undefined]> {
    let deployment: DeployResult | undefined;
    if (permanentId) {
        // Use "permanentId" to find the deployment during its "permanent" phase
        deployment = await kuduClient.deployment.getResult(permanentId);
    } else if (initialReceivedTime) {
        // Use "initialReceivedTime" to find the deployment during its "temp" phase
        deployment = (await kuduClient.deployment.getDeployResults())
            .filter((deployResult: DeployResult) => deployResult.receivedTime && deployResult.receivedTime >= initialReceivedTime)
            .sort((a: DeployResult, b: DeployResult) => b.receivedTime.valueOf() - a.receivedTime.valueOf())
            .shift();
        if (deployment && !deployment.isTemp) {
            // Make note of the id once the deplyoment has shifted to the "permanent" phase, so that we can use that to find the deployment going forward
            permanentId = deployment.id;
        }
    } else {
        // Use "latest" to get the deployment before we know the "initialReceivedTime" or "permanentId"
        deployment = await kuduClient.deployment.getResult('latest');
        if (deployment && deployment.receivedTime) {
            // Make note of the initialReceivedTime, so that we can use that to find the deployment going forward
            initialReceivedTime = deployment.receivedTime;
        }
    }

    return [deployment, permanentId, initialReceivedTime];
}
