/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WorkspaceFolder } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';

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

    stopAppBeforeDeploy?: boolean;
    syncTriggersPostDeploy?: boolean;
}
