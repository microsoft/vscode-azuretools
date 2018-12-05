/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import { workspace } from 'vscode';
import { IActionContext, ISubscriptionWizardContext, LocationListStep } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
import { createAppService } from './createAppService';
import { IAppCreateOptions } from './IAppCreateOptions';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export const pythonRuntime: string = 'python|3.7';

export async function createWebApp(
    actionContext: IActionContext,
    subscriptionContext: ISubscriptionWizardContext,
    createOptions?: IAppCreateOptions,
    showCreatingTreeItem?: (label: string) => void): Promise<Site> {
    return await createAppService(AppKind.app, actionContext, subscriptionContext, createOptions, showCreatingTreeItem);
}

export async function setWizardContextDefaults(wizardContext: IAppServiceWizardContext): Promise<void> {
    await LocationListStep.setLocation(wizardContext, 'centralus');
    // defaults that for if one workspace is opened
    if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        const fsPath: string = workspace.workspaceFolders[0].uri.fsPath;
        if (await fse.pathExists(path.join(fsPath, 'package.json'))) {
            wizardContext.newSiteOS = WebsiteOS.linux;
        } else if (await fse.pathExists(path.join(fsPath, '*.csproj'))) {
            wizardContext.newSiteOS = WebsiteOS.windows;
        } else if (await fse.pathExists(path.join(fsPath, 'requirements.txt'))) {
            // requirements.txt are used to pip install so a good way to determine it's a Python app
            wizardContext.newSiteOS = WebsiteOS.linux;
            wizardContext.detectedSiteRuntime = pythonRuntime;
        }
    }
}
