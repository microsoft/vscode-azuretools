/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from 'azure-arm-website';
import { AzureWizardPromptStep, createAzureClient, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AppKind, getWebsiteOSDisplayName, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class SiteOSStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<IAppServiceWizardContext> {
        if (wizardContext.newSiteOS === undefined) {
            const picks: IAzureQuickPickItem<WebsiteOS>[] = Object.keys(WebsiteOS).map((key: string) => {
                const os: WebsiteOS = <WebsiteOS>WebsiteOS[key];
                return { label: getWebsiteOSDisplayName(os), description: '', data: os };
            });

            wizardContext.newSiteOS = (await ext.ui.showQuickPick(picks, { placeHolder: localize('selectOS', 'Select an OS.') })).data;
        }

        let options: {} = {};
        if (wizardContext.newSiteOS === 'linux') {
            if (wizardContext.newSiteKind === AppKind.functionapp) {
                options = { linuxDynamicWorkersEnabled: true };
            } else {
                options = { linuxWorkersEnabled: true };
            }
        }
        // Overwrite the generic 'locationsTask' with a list of locations specific to provider "Microsoft.Web"
        const client: WebSiteManagementClient = createAzureClient(wizardContext, WebSiteManagementClient);
        wizardContext.locationsTask = client.listGeoRegions(options);

        return wizardContext;
    }
}
