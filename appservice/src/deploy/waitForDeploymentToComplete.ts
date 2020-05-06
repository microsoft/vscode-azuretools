/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, window } from 'vscode';
import { IActionContext, IParsedError, parseError } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { DeployResult, LogEntry } from 'vscode-azurekudu/lib/models';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { delay } from '../utils/delay';
import { ignore404Error, retryKuduCall } from '../utils/kuduUtils';
import { nonNullProp } from '../utils/nonNull';
import { IDeployContext } from './IDeployContext';

export async function waitForDeploymentToComplete(context: IDeployContext, client: SiteClient, expectedId?: string, token?: CancellationToken, pollingInterval: number = 5000): Promise<void> {
    let fullLog: string = '';

    let lastLogTime: Date = new Date(0);
    let initialStartTime: Date | undefined;
    let deployment: DeployResult | undefined;
    let permanentId: string | undefined;
    // a 60 second timeout period to let Kudu initialize the deployment
    const maxTimeToWaitForExpectedId: number = Date.now() + 60 * 1000;
    const kuduClient: KuduClient = await client.getKuduClient();

    while (!token?.isCancellationRequested) {
        [deployment, permanentId, initialStartTime] = await tryGetLatestDeployment(context, kuduClient, permanentId, initialStartTime, expectedId);
        if ((deployment === undefined || !deployment.id)) {
            if (expectedId && Date.now() < maxTimeToWaitForExpectedId) {
                await delay(pollingInterval);
                continue;
            }

            throw new Error(localize('failedToFindDeployment', 'Failed to get status of deployment.'));
        }

        const deploymentId: string = deployment.id;
        let logEntries: LogEntry[] = [];
        await retryKuduCall(context, 'getLogEntry', async () => {
            await ignore404Error(context, async () => {
                logEntries = (await kuduClient.deployment.getLogEntry(deploymentId)).reverse();
            });
        });

        let lastLogTimeForThisPoll: Date | undefined;
        // tslint:disable-next-line: no-constant-condition
        while (true) {
            const newEntry: LogEntry | undefined = logEntries.pop();
            if (!newEntry) {
                break;
            }

            if (newEntry.message && newEntry.logTime && newEntry.logTime > lastLogTime) {
                fullLog = fullLog.concat(newEntry.message);
                ext.outputChannel.appendLog(newEntry.message, { date: newEntry.logTime, resourceName: client.fullName });
                lastLogTimeForThisPoll = newEntry.logTime;
            }

            await retryKuduCall(context, 'getLogEntryDetails', async () => {
                await ignore404Error(context, async () => {
                    if (newEntry.id && newEntry.detailsUrl) {
                        const details: LogEntry[] = await kuduClient.deployment.getLogEntryDetails(deploymentId, newEntry.id);
                        logEntries.push(...details.reverse());
                    }
                });
            });
        }

        if (lastLogTimeForThisPoll) {
            lastLogTime = lastLogTimeForThisPoll;
        }

        if (deployment.complete) {
            if (deployment.status === 3 /* Failed */ || deployment.isTemp) { // If the deployment completed without making it to the "permanent" phase, it must have failed
                const message: string = localize('deploymentFailed', 'Deployment to "{0}" failed.', client.fullName);
                const viewOutput: string = localize('viewOutput', 'View Output');
                // don't wait
                window.showErrorMessage(message, viewOutput).then(result => {
                    if (result === viewOutput) {
                        ext.outputChannel.show();
                    }
                });

                const messageWithoutName: string = localize('deploymentFailedWithoutName', 'Deployment failed.');
                ext.outputChannel.appendLog(messageWithoutName, { resourceName: client.fullName });
                context.errorHandling.suppressDisplay = true;
                throw new Error(messageWithoutName);
            } else {
                context.syncTriggersPostDeploy = client.isFunctionApp && !/syncing/i.test(fullLog);
                return;
            }
        } else {
            await delay(pollingInterval);
        }
    }
}

async function tryGetLatestDeployment(context: IActionContext, kuduClient: KuduClient, permanentId: string | undefined, initialStartTime: Date | undefined, expectedId?: string): Promise<[DeployResult | undefined, string | undefined, Date | undefined]> {
    let deployment: DeployResult | undefined;

    if (permanentId) {
        // Use "permanentId" to find the deployment during its "permanent" phase
        deployment = await retryKuduCall(context, 'getResult', async () => {
            // tslint:disable-next-line: no-non-null-assertion
            return await kuduClient.deployment.getResult(permanentId!);
        });
    } else if (expectedId) {
        // if we have a "expectedId" we know which deployment we are looking for, so wait until latest id reflects that
        try {
            const latestDeployment: DeployResult = await retryKuduCall(context, 'getResult', async () => {
                return await kuduClient.deployment.getResult('latest');
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
        const deployments: DeployResult[] = await retryKuduCall(context, 'getDeployResults', async () => {
            return await kuduClient.deployment.getDeployResults();
        });
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
            deployment = await retryKuduCall(context, 'getResult', async () => {
                return <DeployResult | undefined>await kuduClient.deployment.getResult('latest');
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
