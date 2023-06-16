/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SiteSourceControl } from '@azure/arm-appservice';
import { AzExtTreeItem, createContextValue, IActionContext, nonNullProp, openReadOnlyContent, TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import * as os from 'os';
import { l10n, ProgressLocation, ThemeIcon, window } from 'vscode';
import type * as KuduModels from '../KuduModels';
import { waitForDeploymentToComplete } from '../deploy/waitForDeploymentToComplete';
import { ext } from '../extensionVariables';
import { ignore404Error, retryKuduCall } from '../utils/kuduUtils';
import { openUrl } from '../utils/openUrl';
import { DeploymentsTreeItem } from './DeploymentsTreeItem';

// Kudu DeployStatus: https://github.com/projectkudu/kudu/blob/a13592e6654585d5c2ee5c6a05fa39fa812ebb84/Kudu.Contracts/Deployment/DeployStatus.cs
enum DeployStatus {
    Building = 0,
    Deploying = 1,
    Pending = 2,
    Failed = 3,
    Success = 4
}

/**
 * NOTE: This leverages two commands prefixed with `ext.prefix` that should be registered by each extension: "showOutputChannel" and "viewDeploymentLogs"
 */
export class DeploymentTreeItem extends AzExtTreeItem {
    public static contextValue: RegExp = new RegExp('deployment\/.*');
    public label: string;
    public receivedTime: Date;
    public parent: DeploymentsTreeItem;
    private _deployResult: KuduModels.DeployResult;
    private _scmType?: string;

    constructor(parent: DeploymentsTreeItem, deployResult: KuduModels.DeployResult, scmType: string | undefined) {
        super(parent);
        this._scmType = scmType;
        this._deployResult = deployResult;
        this.receivedTime = nonNullProp(deployResult, 'receivedTime');
        const message: string = this.getDeploymentMessage(deployResult);
        this.label = `${this.id.substring(0, 7)} - ${message}`;
    }

    public get contextValue(): string {
        return createContextValue([`deployment/${this._scmType}`.toLocaleLowerCase(), ...this.parent.contextValuesToAdd]);
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('git-commit');
    }

    public get id(): string {
        return nonNullProp(this._deployResult, 'id');
    }

    public get commandId(): string {
        return `${ext.prefix}.viewDeploymentLogs`;
    }

    public get description(): string | undefined {
        if (this._deployResult.active) {
            return l10n.t('Active');
        }

        switch (this._deployResult.status) {
            case DeployStatus.Building:
                return l10n.t('Building...');
            case DeployStatus.Deploying:
                return l10n.t('Deploying...');
            case DeployStatus.Pending:
                return l10n.t('Pending...');
            case DeployStatus.Failed:
                return l10n.t('Failed');
            case DeployStatus.Success:
            default:
                return;
        }
    }

    public isAncestorOfImpl(contextValue: string | RegExp): boolean {
        return this.contextValue === contextValue;
    }

    public async redeployDeployment(context: IActionContext): Promise<void> {
        if (this._deployResult.isReadonly) {
            throw new Error(l10n.t('Redeploy is not supported for non-git deployments.'));
        }
        const redeploying: string = l10n.t('Redeploying commit "{0}" to "{1}". Check [output window](command:{2}) for status.', this.id, this.parent.site.fullName, ext.prefix + '.showOutputChannel');
        const redeployed: string = l10n.t('Commit "{0}" has been redeployed to "{1}".', this.id, this.parent.site.fullName);
        await window.withProgress({ location: ProgressLocation.Notification, title: redeploying }, async (): Promise<void> => {
            ext.outputChannel.appendLog(l10n.t('Redeploying commit "{0}" to "{1}"...', this.id, this.parent.site.fullName), { resourceName: this.parent.site.fullName });
            const kuduClient = await this.parent.site.createClient(context);
            void kuduClient.deploy(context, this.id);

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            const refreshingInteveral: NodeJS.Timer = setInterval(async () => { await this.refresh(context); }, 1000); /* the status of the label changes during deployment so poll for that*/
            try {
                await waitForDeploymentToComplete(context, this.parent.site, { expectedId: this.id });
                await this.parent.refresh(context); /* refresh entire node because active statuses has changed */
                void window.showInformationMessage(redeployed);
                ext.outputChannel.appendLog(redeployed);
            } finally {
                clearInterval(refreshingInteveral);
            }

        });
    }

    public async getDeploymentLogs(context: IActionContext): Promise<string> {
        const kuduClient = await this.parent.site.createClient(context);
        let logEntries: KuduModels.LogEntry[] = [];
        await retryKuduCall(context, 'getLogEntry', async () => {
            await ignore404Error(context, async () => {
                logEntries = await kuduClient.getLogEntry(context, this.id);
            });
        });

        let data: string = '';
        for (const logEntry of logEntries) {
            data += this.formatLogEntry(logEntry);
            let detailedLogEntries: KuduModels.LogEntry[] = [];
            await retryKuduCall(context, 'getLogEntryDetails', async () => {
                await ignore404Error(context, async () => {
                    if (logEntry.detailsUrl && logEntry.id) {
                        detailedLogEntries = await kuduClient.getLogEntryDetails(context, this.id, logEntry.id);
                    }
                });
            });

            for (const detailedEntry of detailedLogEntries) {
                data += this.formatLogEntry(detailedEntry);
            }
        }

        return data;
    }

    public async viewDeploymentLogs(context: IActionContext): Promise<void> {
        await this.runWithTemporaryDescription(context, l10n.t('Retrieving logs...'), async () => {
            const logData: string = await this.getDeploymentLogs(context);
            await openReadOnlyContent(this, logData, '.log');
        });
    }

    public async viewCommitInGitHub(context: IActionContext): Promise<void> {
        const client = await this.parent.site.createClient(context);
        const sourceControl: SiteSourceControl = await client.getSourceControl();
        if (sourceControl.repoUrl) {
            const gitHubCommitUrl: string = `${sourceControl.repoUrl}/commit/${this._deployResult.id}`;
            await openUrl(gitHubCommitUrl);
            return;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            throw new Error(l10n.t('There is no GitHub repo url associated with deployment "{0}".', this._deployResult.id!));
        }
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        const kuduClient = await this.parent.site.createClient(context);
        this._deployResult = await kuduClient.getDeployResult(context, this.id);
    }

    private formatLogEntry(logEntry: KuduModels.LogEntry): string {
        if (logEntry.logTime && logEntry.message) {
            return `${logEntry.logTime.toISOString()} - ${logEntry.message}${os.EOL}`;
        } else {
            return '';
        }
    }

    private getDeploymentMessage(deployResult: KuduModels.DeployResult): string {
        let message: string = nonNullProp(deployResult, 'message');
        try {
            const messageJSON: { message?: string } = <{ message?: string }>JSON.parse(message);
            if (messageJSON.message) {
                message = messageJSON.message;
            }
        } catch {
            // Ignore and assume message was not in JSON format
        }
        const firstLine: string = this.getFirstLine(message);
        /* truncate long messages and add "..." */
        return firstLine.length > 50 ? `${firstLine.substring(0, 50)}...` : firstLine;
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
