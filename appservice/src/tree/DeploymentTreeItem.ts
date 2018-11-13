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
import { DeploymentsTreeItem } from './DeploymentsTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

export class DeploymentTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'deployment';
    public readonly contextValue: string = DeploymentTreeItem.contextValue;
    public label: string;
    public active: boolean;
    public receivedTime: Date;
    public parent: DeploymentsTreeItem;
    private _kuduClient: KuduClient;
    private _deployResult: DeployResult;

    constructor(parent: DeploymentsTreeItem, deployResult: DeployResult, kuduClient: KuduClient) {
        super(parent);
        this._deployResult = deployResult;
        if (!this._deployResult.receivedTime || !this._deployResult.message || this._deployResult.active === undefined) {
            throw new Error('Invalid Deployment Result.');
        }
        this._kuduClient = kuduClient;
        this.receivedTime = this._deployResult.receivedTime;
        this.active = this._deployResult.active;
        this.label = `${this.id.substring(0, 7)} - ${this._deployResult.message.substring(0, 50)}`;
        if (this._deployResult.message.length > 50) { /* if the message was truncated, add "..." */
            this.label += '...';
        }

        if (this.active) {
            this.description = 'Active';
        }
        if (!this._deployResult.lastSuccessEndTime) {
            this.description = 'Failed';
        }
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Git_Commit_16x.svg'),
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Git_Commit_16x.svg')
        };
    }

    public get id(): string {
        if (!this._deployResult.id) {
            throw new Error('Invalid Deployment Result.');
        }
        return this._deployResult.id;
    }

    public async redeployDeployment(): Promise<void> {
        const redeploying: string = `Redeploying commit "${this.id}" to "${this.root.client.fullName}"`;
        const deployed: string = `Commit "${this.id}" has been redeployed to "${this.root.client.fullName}".`;
        window.withProgress({ location: ProgressLocation.Notification, title: redeploying }, async (): Promise<void> => {
            ext.outputChannel.appendLine(redeploying);
            // tslint:disable-next-line:no-non-null-assertion
            await this._kuduClient.deployment.deploy(this.id!);
            await this.parent.refresh();
            window.showInformationMessage(deployed);
            ext.outputChannel.appendLine(deployed);
        });
    }

    public async getDeploymentLogs(): Promise<string> {
        const logEntries: LogEntry[] = await this._kuduClient.deployment.getLogEntry(this.id);
        let data: string = '';
        for (const logEntry of logEntries) {
            data += this.parseLogEntry(logEntry);
            if (logEntry.detailsUrl && logEntry.id) {
                const detailedLogEntries: LogEntry[] = await this._kuduClient.deployment.getLogEntryDetails(this.id, logEntry.id);
                for (const detailedEntry of detailedLogEntries) {
                    data += this.parseLogEntry(detailedEntry);
                }
            }
        }
        return data;
    }

    public async showDeploymentLogs(): Promise<void> {
        const logData: string = await this.getDeploymentLogs();
        const logDocument: TextDocument = await workspace.openTextDocument({ content: logData, language: 'log' });
        await window.showTextDocument(logDocument);
    }

    private parseLogEntry(logEntry: LogEntry): string {
        if (logEntry.logTime && logEntry.message) {
            return `${logEntry.logTime.toISOString()} - ${logEntry.message} ${os.EOL}`;
        } else {
            return '';
        }
    }
}
