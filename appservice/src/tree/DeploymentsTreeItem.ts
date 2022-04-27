/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SiteConfig, SiteSourceControl } from '@azure/arm-appservice';
import { AzExtParentTreeItem, AzExtTreeItem, createContextValue, GenericTreeItem, IActionContext, TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { ThemeIcon } from 'vscode';
import { KuduModels } from 'vscode-azurekudu';
import { createKuduClient } from '../createKuduClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ScmType } from '../ScmType';
import { ParsedSite } from '../SiteClient';
import { retryKuduCall } from '../utils/kuduUtils';
import { DeploymentTreeItem } from './DeploymentTreeItem';

interface DeploymentsTreeItemOptions {
    site: ParsedSite;
    siteConfig: SiteConfig;
    sourceControl: SiteSourceControl;
    contextValuesToAdd?: string[];
}

/**
 * NOTE: This leverages a command with id `ext.prefix + '.connectToGitHub'` that should be registered by each extension
 */
export class DeploymentsTreeItem extends AzExtParentTreeItem {
    public static contextValueConnected: string = 'deploymentsConnected';
    public static contextValueUnconnected: string = 'deploymentsUnconnected';
    public readonly label: string = localize('Deployments', 'Deployments');
    public readonly childTypeLabel: string = localize('Deployment', 'Deployment');
    public readonly site: ParsedSite;
    public suppressMaskLabel: boolean = true;
    public readonly contextValuesToAdd: string[];

    private _scmType?: string;
    private _repoUrl?: string;

    public constructor(parent: AzExtParentTreeItem, options: DeploymentsTreeItemOptions) {
        super(parent);
        this.site = options.site;
        this._scmType = options.siteConfig.scmType;
        this._repoUrl = options.sourceControl.repoUrl;
        this.contextValuesToAdd = options?.contextValuesToAdd || [];
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('cloud-upload');
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
        return createContextValue([this._scmType ? DeploymentsTreeItem.contextValueUnconnected : DeploymentsTreeItem.contextValueConnected, ...this.contextValuesToAdd]);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const client = await this.site.createClient(context);
        const siteConfig: SiteConfig = await client.getSiteConfig();
        const kuduClient = await createKuduClient(context, this.site);
        const deployments: KuduModels.DeployResult[] = await retryKuduCall(context, 'getDeployResults', async () => {
            return kuduClient.deployment.getDeployResults();
        });

        const children: DeploymentTreeItem[] | GenericTreeItem[] = await this.createTreeItemsWithErrorHandling(
            deployments,
            'invalidDeployment',
            dr => {
                return new DeploymentTreeItem(this, dr, siteConfig.scmType);
            },
            dr => {
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

    public async refreshImpl(context: IActionContext): Promise<void> {
        const client = await this.site.createClient(context);
        const siteConfig: SiteConfig = await client.getSiteConfig();
        const sourceControl: SiteSourceControl = await client.getSourceControl();
        this._scmType = siteConfig.scmType;
        this._repoUrl = sourceControl.repoUrl;
    }
}
