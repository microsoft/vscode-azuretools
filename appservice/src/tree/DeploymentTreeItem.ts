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
import { nonNullProp } from '../utils/nonNull';
import { DeploymentsTreeItem } from './DeploymentsTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

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
        const active: boolean = nonNullProp(deployResult, 'active');
        let message: string = nonNullProp(deployResult, 'message');
        if (message.length > 50) { /* truncate long messages and add "..." */
            message = `${message.substring(0, 50)}...`;
        }
        this.label = `${this.id.substring(0, 7)} - ${message}`;

        if (active) {
            this.description = 'Active';
        } else if (!this._deployResult.lastSuccessEndTime && this._deployResult.complete) {
            this.description = 'Failed';
        } else if (!this._deployResult.complete) {
            this.description = 'Deploying...';
        }
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

    public async redeployDeployment(): Promise<void> {
        const redeploying: string = `Redeploying commit "${this.id}" to "${this.root.client.fullName}"`;
        const deployed: string = `Commit "${this.id}" has been redeployed to "${this.root.client.fullName}".`;
        window.withProgress({ location: ProgressLocation.Notification, title: redeploying }, async (): Promise<void> => {
            const kuduClient: KuduClient = await getKuduClient(this.root.client);
            ext.outputChannel.appendLine(redeploying);
            await kuduClient.deployment.deploy(this.id);
            await this.parent.refresh();
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

    private formatLogEntry(logEntry: LogEntry): string {
        if (logEntry.logTime && logEntry.message) {
            return `${logEntry.logTime.toISOString()} - ${logEntry.message}${os.EOL}`;
        } else {
            return '';
        }
    }
}
