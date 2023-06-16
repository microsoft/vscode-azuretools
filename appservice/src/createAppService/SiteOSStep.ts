/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { getWebsiteOSDisplayName, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { setLocationsTask } from './setLocationsTask';

export class SiteOSStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(context: IAppServiceWizardContext): Promise<void> {
        const picks: IAzureQuickPickItem<WebsiteOS>[] = Object.keys(WebsiteOS).map((key: string) => {
            const os: WebsiteOS = <WebsiteOS>WebsiteOS[key];
            return { label: getWebsiteOSDisplayName(os), description: '', data: os };
        });

        context.newSiteOS = (await context.ui.showQuickPick(picks, { placeHolder: vscode.l10n.t('Select an OS.') })).data;
        await setLocationsTask(context);
    }

    public shouldPrompt(context: IAppServiceWizardContext): boolean {
        return context.newSiteOS === undefined;
    }
}
