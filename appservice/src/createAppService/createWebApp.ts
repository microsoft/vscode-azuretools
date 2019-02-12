/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import { Uri, workspace } from 'vscode';
import { IActionContext, ISubscriptionWizardContext, LocationListStep } from 'vscode-azureextensionui';
import { javaUtils } from '../utils/javaUtils';
import { AppKind, LinuxRuntimes, WebsiteOS } from './AppKind';
import { createAppService } from './createAppService';
import { IAppCreateOptions } from './IAppCreateOptions';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export async function createWebApp(
    actionContext: IActionContext,
    subscriptionContext: ISubscriptionWizardContext,
    createOptions?: IAppCreateOptions,
    showCreatingTreeItem?: (label: string) => void): Promise<Site> {
    return await createAppService(AppKind.app, actionContext, subscriptionContext, createOptions, showCreatingTreeItem);
}

export async function setWizardContextDefaults(wizardContext: IAppServiceWizardContext, actionContext: IActionContext, advancedCreation?: boolean): Promise<void> {
    // only detect if one workspace is opened
    if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        const fsPath: string = workspace.workspaceFolders[0].uri.fsPath;
        if (await fse.pathExists(path.join(fsPath, 'package.json'))) {
            wizardContext.recommendedSiteRuntime = LinuxRuntimes.node;
        } else if (await fse.pathExists(path.join(fsPath, 'requirements.txt'))) {
            // requirements.txt are used to pip install so a good way to determine it's a Python app
            wizardContext.recommendedSiteRuntime = LinuxRuntimes.python;
        } else if (await javaUtils.isJavaProject(fsPath)) {
            wizardContext.newSiteOS = WebsiteOS.linux;
            wizardContext.newPlanSku = { name: 'P1v2', tier: 'PremiumV2', size: 'P1v2', family: 'P', capacity: 1 };
        }
        actionContext.properties.recommendedSiteRuntime = wizardContext.recommendedSiteRuntime;
    }

    if (!advancedCreation) {
        await LocationListStep.setLocation(wizardContext, 'centralus');
        // we only set the OS for the non-advanced creation scenario
        // tslint:disable-next-line:strict-boolean-expressions
        if (wizardContext.recommendedSiteRuntime) {
            wizardContext.newSiteOS = WebsiteOS.linux;
        } else {
            await workspace.findFiles('*.csproj').then((files: Uri[]) => {
                if (files.length > 0) {
                    wizardContext.newSiteOS = WebsiteOS.windows;
                }
            });
        }
    }
}
