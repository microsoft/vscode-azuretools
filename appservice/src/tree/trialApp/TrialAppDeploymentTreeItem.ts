/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzureTreeItem, TreeItemIconPath } from 'vscode-azureextensionui';
import { DeploymentsTreeItem, ISiteTreeRoot } from '../..';
import { ScmType } from '../../ScmType';
import { TrialAppClient } from '../../TrialAppClient';
import { getThemedIconPath } from '../IconPath';

// Kudu DeployStatus: https://github.com/projectkudu/kudu/blob/a13592e6654585d5c2ee5c6a05fa39fa812ebb84/Kudu.Contracts/Deployment/DeployStatus.cs
/**
 * NOTE: This leverages two commands prefixed with `ext.prefix` that should be registered by each extension: "showOutputChannel" and "viewDeploymentLogs"
 */
export class TrialAppDeploymentTreeItem extends AzureTreeItem<ISiteTreeRoot> {

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('Deployments_x16');
    }

    public get id(): string {
        return 'trialAppDeploymentId';
    }

    public get commandId(): string {
        return 'logs';
    }

    public get description(): string | undefined {
        return 'Git';
    }
    public static contextValue: RegExp = new RegExp('deployment\/.*');
    public readonly contextValue: string;
    public label: string;
    public receivedTime: Date;
    public parent: DeploymentsTreeItem;
    public client: TrialAppClient;

    constructor(parent: AzExtParentTreeItem, client: TrialAppClient) {
        super(parent);
        this.client = client;
        this.contextValue = `deployment/${ScmType.LocalGit}`.toLocaleLowerCase();
        this.label = 'Deploy';
    }

    public isAncestorOfImpl(contextValue: string | RegExp): boolean {
        return this.contextValue === contextValue;
    }
}
