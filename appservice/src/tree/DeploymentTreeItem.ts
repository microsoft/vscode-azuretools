/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import { ProgressLocation, TextDocument, window, workspace } from 'vscode';
import { AzureTreeItem } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { DeployResult, LogEntry } from 'vscode-azurekudu/lib/models';
import { formatDeployLog } from '../deploy/formatDeployLog';
import { waitForDeploymentToComplete } from '../deploy/waitForDeploymentToComplete';
import { ext } from '../extensionVariables';
import { getKuduClient } from '../getKuduClient';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { DeploymentsTreeItem } from './DeploymentsTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

// Kudu DeployStatus: https://github.com/projectkudu/kudu/blob/a13592e6654585d5c2ee5c6a05fa39fa812ebb84/Kudu.Contracts/Deployment/DeployStatus.cs
enum DeployStatus {
    Building = 0,
    Deploying = 1,
    Pending = 2,
    Failed = 3,
    Success = 4
}

export class DeploymentTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deployment';
    public readonly contextValue: string = DeploymentTreeItem.contextValue;
    public label: string;
    public receivedTime: Date;
    public parent: DeploymentsTreeItem;
    private _deployResult: DeployResult;

    constructor(parent: DeploymentsTreeItem, deployResult: DeployResult) {
        super(parent);
        this._deployResult = deployResult;
        this.receivedTime = nonNullProp(deployResult, 'receivedTime');
        let message: string = nonNullProp(deployResult, 'message');
        message = this.getFirstLine(message);
        if (message.length > 50) { /* truncate long messages and add "..." */
            message = `${message.substring(0, 50)}...`;
        }
        this.label = `${this.id.substring(0, 7)} - ${message}`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Git_Commit_16x.svg'),
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Git_Commit_16x.svg')
        };
    }

    public get id(): string {
        this._deployResult.id = nonNullProp(this._deployResult, 'id');
        return this._deployResult.id;
    }

    public get description(): string | undefined {
        if (this._deployResult.active) {
            return localize('active', 'Active');
        }

        switch (this._deployResult.status) {
            case DeployStatus.Building:
                return localize('building', 'Building...');
            case DeployStatus.Deploying:
                return localize('deploying', 'Deploying...');
            case DeployStatus.Pending:
                return localize('pending', 'Pending...');
            case DeployStatus.Failed:
                return localize('failed', 'Failed');
            case DeployStatus.Success:
            default:
                return;
        }
    }

    public async redeployDeployment(): Promise<void> {
        if (this._deployResult.isReadonly) {
            throw new Error(localize('redeployNotSupported', 'Redeploy is not supported for non-git deployments.'));
        }
        const redeploying: string = localize('redeploying', 'Redeploying commit "{0}" to "{1}". Check output window for status.', this.id, this.root.client.fullName);
        const redeployed: string = localize('redeployed', 'Commit "{0}" has been redeployed to "{1}".', this.id, this.root.client.fullName);
        await window.withProgress({ location: ProgressLocation.Notification, title: redeploying }, async (): Promise<void> => {
            ext.outputChannel.appendLine(formatDeployLog(this.root.client, localize('reployingOutput', 'Redeploying commit "{0}" to "{1}"...', this.id, this.root.client.fullName)));
            const kuduClient: KuduClient = await getKuduClient(this.root.client);
            const refreshingInteveral: NodeJS.Timer = setInterval(async () => { await this.refresh(); }, 1000); /* the status of the label changes during deployment so poll for that*/
            let getResultInterval: NodeJS.Timer | undefined;
            try {
                await new Promise((resolve: () => void, reject: (error: Error) => void): void => {
                    kuduClient.deployment.deploy(this.id).catch(reject);
                    getResultInterval = setInterval(
                        async () => {
                            const deployResult: DeployResult | undefined = <DeployResult | undefined>await kuduClient.deployment.getResult('latest');
                            if (deployResult && deployResult.id === this.id) {
                                resolve();
                            }
                        },
                        3000
                    );
                    const timeout: string = localize('redeployTimeout', 'Redeploying commit "{0}" was unable to resolve and has timed out.', this.id);
                    // a 20 second timeout period to let Kudu initialize the deployment
                    setTimeout(() => reject(new Error(timeout)), 20000);
                });
                await waitForDeploymentToComplete(this.root.client, kuduClient);
                await this.parent.refresh(); /* refresh entire node because active statuses has changed */
                window.showInformationMessage(redeployed);
                ext.outputChannel.appendLine(redeployed);
            } finally {
                clearInterval(refreshingInteveral);
                if (getResultInterval) {
                    clearInterval(getResultInterval);
                }
            }

        });
    }

    public async getDeploymentLogs(): Promise<string> {
        const kuduClient: KuduClient = await getKuduClient(this.root.client);
        const logEntries: LogEntry[] = await kuduClient.deployment.getLogEntry(this.id);
        let data: string = '';
        for (const logEntry of logEntries) {
            data += this.formatLogEntry(logEntry);
            if (logEntry.detailsUrl && logEntry.id) {
                const detailedLogEntries: LogEntry[] = await kuduClient.deployment.getLogEntryDetails(this.id, logEntry.id);
                for (const detailedEntry of detailedLogEntries) {
                    data += this.formatLogEntry(detailedEntry);
                }
            }
        }
        return data;
    }

    public async viewDeploymentLogs(): Promise<void> {
        await this.runWithTemporaryDescription(localize('retrievingLogs', 'Retrieving logs...'), async () => {
            const logData: string = await this.getDeploymentLogs();
            const logDocument: TextDocument = await workspace.openTextDocument({ content: logData, language: 'log' });
            await window.showTextDocument(logDocument);
        });
    }

    public async refreshLabelImpl(): Promise<void> {
        const kuduClient: KuduClient = await getKuduClient(this.root.client);
        // while this doesn't directly refresh the label, it's currently the only place to run async code on refresh
        this._deployResult = await kuduClient.deployment.getResult(this.id);
    }

    private formatLogEntry(logEntry: LogEntry): string {
        if (logEntry.logTime && logEntry.message) {
            return `${logEntry.logTime.toISOString()} - ${logEntry.message}${os.EOL}`;
        } else {
            return '';
        }
    }

    private getFirstLine(message: string): string {
        const allLineBreaks: RegExp = /\r?\n|\r/;
        const index: number = message.search(allLineBreaks);
        if (index >= 0) {
            message = message.substring(0, index);
        }

        return message;
    }
}
