/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfig, SiteSourceControl } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { MessageItem } from 'vscode';
import { AzureParentTreeItem, createTreeItemsWithErrorHandling, DialogResponses, GenericTreeItem, IActionContext } from 'vscode-azureextensionui';
import { DeployResult } from 'vscode-azurekudu/lib/models';
import { editScmType } from '../editScmType';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ScmType } from '../ScmType';
import { DeploymentTreeItem } from './DeploymentTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

export class DeploymentsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValueConnected: string = 'deploymentsConnected';
    public static contextValueUnconnected: string = 'deploymentsUnconnected';
    public parent: AzureParentTreeItem<ISiteTreeRoot>;
    public readonly label: string = localize('Deployments', 'Deployments');
    public readonly childTypeLabel: string = localize('Deployment', 'Deployment');

    private readonly _connectToGitHubCommandId: string;
    private _scmType?: string;
    private _repoUrl?: string;

    public constructor(parent: AzureParentTreeItem<ISiteTreeRoot>, siteConfig: SiteConfig, sourceControl: SiteSourceControl, connectToGitHubCommandId: string) {
        super(parent);
        this._connectToGitHubCommandId = connectToGitHubCommandId;
        this._scmType = siteConfig.scmType;
        this._repoUrl = sourceControl.repoUrl;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Deployments_x16.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Deployments_x16.svg')
        };
    }

    public get description(): string {
        switch (this._scmType) {
            case ScmType.LocalGit:
                return localize('localGit', 'Local Git');
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

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<DeploymentTreeItem[] | GenericTreeItem<ISiteTreeRoot>[]> {
        const siteConfig: SiteConfig = await this.root.client.getSiteConfig();
        const deployments: DeployResult[] = await this.root.client.kudu.deployment.getDeployResults();
        const children: DeploymentTreeItem[] | GenericTreeItem<ISiteTreeRoot>[] = await createTreeItemsWithErrorHandling(
            this,
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
                commandId: this._connectToGitHubCommandId,
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
        await ext.ui.showWarningMessage(disconnect, { modal: true }, disconnectButton, DialogResponses.cancel);
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
