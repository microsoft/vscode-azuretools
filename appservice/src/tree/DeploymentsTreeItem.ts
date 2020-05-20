/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfig, SiteSourceControl } from 'azure-arm-website/lib/models';
import { MessageItem } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, GenericTreeItem, IActionContext, TreeItemIconPath } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { DeployResult } from 'vscode-azurekudu/lib/models';
import { editScmType } from '../editScmType';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ScmType } from '../ScmType';
import { retryKuduCall } from '../utils/kuduUtils';
import { DeploymentTreeItem } from './DeploymentTreeItem';
import { getThemedIconPath } from './IconPath';
import { ISiteTreeRoot } from './ISiteTreeRoot';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.connectToGitHub'` that should be registered by each extension
 */
export class DeploymentsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValueConnected: string = 'deploymentsConnected';
    public static contextValueUnconnected: string = 'deploymentsUnconnected';
    public parent: AzureParentTreeItem<ISiteTreeRoot>;
    public readonly label: string = localize('Deployments', 'Deployments');
    public readonly childTypeLabel: string = localize('Deployment', 'Deployment');

    private _scmType?: string;
    private _repoUrl?: string;

    public constructor(parent: AzureParentTreeItem<ISiteTreeRoot>, siteConfig: SiteConfig, sourceControl: SiteSourceControl) {
        super(parent);
        this._scmType = siteConfig.scmType;
        this._repoUrl = sourceControl.repoUrl;
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('Deployments_x16');
    }

    public get description(): string {
        switch (this._scmType) {
            case ScmType.LocalGit:
                return localize('git', 'Git');
            case ScmType.GitHub:
                // remove github from the repoUrl which leaves only the org/repo names
                return this._repoUrl ? this._repoUrl.substring('https://github.com/'.length) : localize('gitHub', 'GitHub');
            case ScmType.None:
            default:
                return '';
        }
    }

    public get contextValue(): string {
        return this._scmType === ScmType.None ? DeploymentsTreeItem.contextValueUnconnected : DeploymentsTreeItem.contextValueConnected;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const siteConfig: SiteConfig = await this.root.client.getSiteConfig();
        const kuduClient: KuduClient = await this.root.client.getKuduClient();
        const deployments: DeployResult[] = await retryKuduCall(context, 'getDeployResults', async () => {
            return kuduClient.deployment.getDeployResults();
        });

        const children: DeploymentTreeItem[] | GenericTreeItem[] = await this.createTreeItemsWithErrorHandling(
            deployments,
            'invalidDeployment',
            (dr: DeployResult) => {
                return new DeploymentTreeItem(this, dr, siteConfig.scmType);
            },
            (dr: DeployResult) => {
                return dr.id ? dr.id.substring(0, 7) : undefined;
            }
        );

        if (siteConfig.scmType === ScmType.None) {
            // redeploy does not support Push deploys, so we still guide users to connect to a GitHub repo
            children.push(new GenericTreeItem(this, {
                commandId: ext.prefix + '.connectToGitHub',
                contextValue: 'ConnectToGithub',
                label: 'Connect to a GitHub Repository...'
            }));
        }
        return children;
    }

    public compareChildrenImpl(ti1: DeploymentTreeItem, ti2: DeploymentTreeItem): number {
        if (ti1 instanceof GenericTreeItem) {
            return 1;
        } else if (ti2 instanceof GenericTreeItem) {
            return -1;
        }
        // sorts in accordance of the most recent deployment
        return ti2.receivedTime.valueOf() - ti1.receivedTime.valueOf();
    }

    public async disconnectRepo(context: IActionContext): Promise<void> {
        const sourceControl: SiteSourceControl = await this.root.client.getSourceControl();
        const disconnectButton: MessageItem = { title: localize('disconnect', 'Disconnect') };
        const disconnect: string = localize('disconnectFromRepo', 'Disconnect from "{0}"? This will not affect your app\'s active deployment. You may reconnect a repository at any time.', sourceControl.repoUrl);
        await ext.ui.showWarningMessage(disconnect, { modal: true }, disconnectButton);
        await editScmType(this.root.client, this.parent, context, ScmType.None);
        await this.refresh();
    }

    public async refreshImpl(): Promise<void> {
        const siteConfig: SiteConfig = await this.root.client.getSiteConfig();
        const sourceControl: SiteSourceControl = await this.root.client.getSourceControl();
        this._scmType = siteConfig.scmType;
        this._repoUrl = sourceControl.repoUrl;
    }
}
