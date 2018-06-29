/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel, Uri, workspace } from 'vscode';
import { IActionContext, IAzureUserInput } from 'vscode-azureextensionui';
import { AppKind, WebsiteOS } from './AppKind';
import { createAppService } from './createAppService';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export async function createWebApp(
    outputChannel: OutputChannel,
    ui: IAzureUserInput,
    actionContext: IActionContext,
    credentials: ServiceClientCredentials,
    subscriptionId: string,
    subscriptionDisplayName: string,
    showCreatingNode?: (label: string) => void,
    advancedCreation: boolean = false): Promise<Site> {
    return await createAppService(AppKind.app, undefined, outputChannel, ui, actionContext, credentials, subscriptionId, subscriptionDisplayName, showCreatingNode, advancedCreation);
}

export async function setWizardContextDefaults(wizardContext: IAppServiceWizardContext): Promise<void> {
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
