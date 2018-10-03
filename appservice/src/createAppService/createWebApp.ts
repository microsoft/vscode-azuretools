/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { Uri, workspace } from 'vscode';
import { IActionContext, ISubscriptionWizardContext, LocationListStep } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
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

export async function setWizardContextDefaults(wizardContext: IAppServiceWizardContext): Promise<void> {
    await LocationListStep.setLocation(wizardContext, 'centralus');
    // defaults that for if one workspace is opened
    if (workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        await workspace.findFiles('package.json').then((files: Uri[]) => {
            if (files.length > 0) {
                wizardContext.newSiteOS = WebsiteOS.linux;
            }
        });

        await workspace.findFiles('*.csproj').then((files: Uri[]) => {
            if (files.length > 0) {
                wizardContext.newSiteOS = WebsiteOS.windows;
            }
        });
    }

}
