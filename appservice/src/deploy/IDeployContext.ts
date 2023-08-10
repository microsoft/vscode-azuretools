/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppServicePlan } from '@azure/arm-appservice';
import { ExecuteActivityContext, IActionContext } from '@microsoft/vscode-azext-utils';
import { WorkspaceFolder } from 'vscode';
import { ParsedSite, SiteClient } from '../SiteClient';

export enum AppSource {
    setting = 'setting',
    tree = 'tree',
    nodePicker = 'nodePicker',
    api = 'api'
}

export interface IDeployContext extends IActionContext {
    workspaceFolder: WorkspaceFolder;
    originalDeployFsPath: string;
    effectiveDeployFsPath: string;

    defaultAppSetting: string;
    appSource?: AppSource;
    isNewApp?: boolean;

    /**
     * Used to overwrite default deploy method based on scm type
     */
    deployMethod?: 'zip' | 'storage' | 'flexconsumption';
    flexConsumptionRemoteBuild?: boolean;
    stopAppBeforeDeploy?: boolean;
    syncTriggersPostDeploy?: boolean;
    /**
     * id retrieved from scm-deployment-id header to track deployment
     */
    locationUrl?: string;
}

// only used by the tools package facilitate creating the wizard execute steps
export interface InnerDeployContext extends IDeployContext, ExecuteActivityContext {
    site: ParsedSite;
    client: SiteClient;
    fsPath: string;
    aspPromise: Promise<AppServicePlan | undefined>
}
