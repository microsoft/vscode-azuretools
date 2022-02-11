/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import { WorkspaceFolder } from 'vscode';

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
    deployMethod?: 'zip' | 'storage';

    stopAppBeforeDeploy?: boolean;
    syncTriggersPostDeploy?: boolean;
}
