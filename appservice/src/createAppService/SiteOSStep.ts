/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { getWebsiteOSDisplayName, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { setLocationsTask } from './setLocationsTask';

export class SiteOSStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const picks: IAzureQuickPickItem<WebsiteOS>[] = Object.keys(WebsiteOS).map((key: string) => {
            const os: WebsiteOS = <WebsiteOS>WebsiteOS[key];
            return { label: getWebsiteOSDisplayName(os), description: '', data: os };
        });

        wizardContext.newSiteOS = (await wizardContext.ui.showQuickPick(picks, { placeHolder: localize('selectOS', 'Select an OS.') })).data;
        await setLocationsTask(wizardContext);
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return wizardContext.newSiteOS === undefined;
    }
}
