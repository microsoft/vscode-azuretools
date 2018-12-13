/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import * as fse from 'fs-extra';
import * as path from 'path';
import { Uri, workspace } from 'vscode';
import { IActionContext, ISubscriptionWizardContext, LocationListStep } from 'vscode-azureextensionui';
import { AppKind, LinuxRuntimes, WebsiteOS } from './AppKind';
import { createAppService } from './createAppService';
import { IAppCreateOptions } from './IAppCreateOptions';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

const falseStr: string = 'false';

export async function createWebApp(
    actionContext: IActionContext,
    subscriptionContext: ISubscriptionWizardContext,
    createOptions?: IAppCreateOptions,
    showCreatingTreeItem?: (label: string) => void): Promise<Site> {
    return await createAppService(AppKind.app, actionContext, subscriptionContext, createOptions, showCreatingTreeItem);
}

export async function getWizardRecommendations(wizardContext: IAppServiceWizardContext, actionContext: IActionContext): Promise<void> {
    actionContext.properties.recommendedSiteRuntime = falseStr;
    actionContext.properties.recommendedWebsiteOS = falseStr;
    // only detect if one workspace is opened
    if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        const fsPath: string = workspace.workspaceFolders[0].uri.fsPath;
        if (await fse.pathExists(path.join(fsPath, 'package.json'))) {
            wizardContext.recommendedSiteRuntime = LinuxRuntimes.node;
        } else if (await fse.pathExists(path.join(fsPath, 'requirements.txt'))) {
            // requirements.txt are used to pip install so a good way to determine it's a Python app
            wizardContext.recommendedSiteRuntime = LinuxRuntimes.python;
        } else {
            await workspace.findFiles('*.csproj').then((files: Uri[]) => {
                if (files.length > 0) {
                    wizardContext.recommendedWebsiteOS = WebsiteOS.windows;
                    actionContext.properties.recommendedWebsiteOS = WebsiteOS.windows;
                }
            });
        }
        if (wizardContext.recommendedSiteRuntime !== falseStr) {
            // this will only be set if we recommend a runtime which means it's a Linux app
            wizardContext.recommendedWebsiteOS = WebsiteOS.linux;
            actionContext.properties.recommendedSiteRuntime = wizardContext.recommendedSiteRuntime;
            actionContext.properties.recommendedWebsiteOS = WebsiteOS.linux;
        }
    }
}

export async function setWizardContextDefaults(wizardContext: IAppServiceWizardContext): Promise<void> {
    await LocationListStep.setLocation(wizardContext, 'centralus');
    // defaults that for if one workspace is opened
    // tslint:disable-next-line:strict-boolean-expressions
    if (wizardContext.recommendedWebsiteOS && wizardContext.recommendedWebsiteOS !== falseStr) {
        // this should be set by `getWizardRecommendations`
        wizardContext.newSiteOS = wizardContext.recommendedWebsiteOS;
    }
}
