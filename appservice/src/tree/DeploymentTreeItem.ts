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
        const redeploying: string = `Redeploying commit "${this.id}" to "${this.root.client.fullName}"`;
        const deployed: string = `Commit "${this.id}" has been redeployed to "${this.root.client.fullName}".`;
        window.withProgress({ location: ProgressLocation.Notification, title: redeploying }, async (): Promise<void> => {
            const kuduClient: KuduClient = await getKuduClient(this.root.client);
            ext.outputChannel.appendLine(redeploying);
            const refreshingInteveral: NodeJS.Timer = setInterval(async () => { await this.refresh(); }, 1000); /* the status of the label changes during deployment so poll for that*/
            await kuduClient.deployment.deploy(this.id);
            await this.parent.refresh(); /* refresh entire node because active statuses has changed */
            clearInterval(refreshingInteveral);
            window.showInformationMessage(deployed);
            ext.outputChannel.appendLine(deployed);
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
        const logData: string = await this.getDeploymentLogs();
        const logDocument: TextDocument = await workspace.openTextDocument({ content: logData, language: 'log' });
        await window.showTextDocument(logDocument);
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
}
