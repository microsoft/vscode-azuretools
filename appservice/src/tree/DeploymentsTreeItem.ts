/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SiteConfig } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { MessageItem } from 'vscode';
import { AzureParentTreeItem, createTreeItemsWithErrorHandling, DialogResponses, GenericTreeItem, IActionContext } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { DeployResult } from 'vscode-azurekudu/lib/models';
import { editScmType } from '../editScmType';
import { ext } from '../extensionVariables';
import { getKuduClient } from '../getKuduClient';
import { localize } from '../localize';
import { ScmType } from '../ScmType';
import { DeploymentTreeItem } from './DeploymentTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

export class DeploymentsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValueConnected: string = 'deploymentsConnected';
    public static contextValueUnconnected: string = 'deploymentsUnconnected';
    public contextValue: string;
    public parent: AzureParentTreeItem<ISiteTreeRoot>;
    public readonly label: string = localize('Deployments', 'Deployments');
    public readonly childTypeLabel: string = localize('Deployment', 'Deployment');

    public constructor(parent: AzureParentTreeItem<ISiteTreeRoot>, siteConfig: SiteConfig) {
        super(parent);
        this.contextValue = siteConfig.scmType === ScmType.None ? DeploymentsTreeItem.contextValueUnconnected : DeploymentsTreeItem.contextValueConnected;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Deployments_x16.svg'),
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Deployments_x16.svg')
        };
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<DeploymentTreeItem[] | GenericTreeItem<ISiteTreeRoot>[]> {
        const siteConfig: SiteConfig = await this.root.client.getSiteConfig();
        if (siteConfig.scmType === ScmType.GitHub || siteConfig.scmType === ScmType.LocalGit) {
            const kuduClient: KuduClient = await getKuduClient(this.root.client);
            const deployments: DeployResult[] = await kuduClient.deployment.getDeployResults();
            return await createTreeItemsWithErrorHandling(
                this,
                deployments,
                'invalidDeployment',
                (dr: DeployResult) => {
                    return new DeploymentTreeItem(this, dr);
                },
                (dr: DeployResult) => {
                    return dr.id ? dr.id.substring(0, 7) : undefined;
                }
            );
        } else {
            return [new GenericTreeItem(this, {
                commandId: 'appService.ConnectToGitHub',
                contextValue: 'ConnectToGithub',
                label: 'Connect to a GitHub repository...'
            })];
        }
    }

    public compareChildrenImpl(ti1: DeploymentTreeItem, ti2: DeploymentTreeItem): number {
        // sorts in accordance of the most recent deployment
        return ti2.receivedTime.valueOf() - ti1.receivedTime.valueOf();
    }

    public async disconnectRepo(context: IActionContext): Promise<void> {
        const disconnectButton: MessageItem = { title: localize('disconnect', 'Disconnect') };
        const disconnect: string = localize('disconnectFromRepo', 'Disconnect from repository? This will not affect your app\'s active deployment. You may reconnect a repository at any time.');
        await ext.ui.showWarningMessage(disconnect, disconnectButton, DialogResponses.cancel);
        await editScmType(this.root.client, this.parent, context, ScmType.None);
        await this.refresh();
    }

    public async refreshLabelImpl(): Promise<void> {
        const siteConfig: SiteConfig = await this.root.client.getSiteConfig();
        // while this doesn't directly refresh the label, it's currently the only place to run async code on refresh
        if (siteConfig.scmType === ScmType.GitHub || siteConfig.scmType === ScmType.LocalGit) {
            this.contextValue = DeploymentsTreeItem.contextValueConnected;
        } else {
            this.contextValue = DeploymentsTreeItem.contextValueUnconnected;
        }
    }
}
