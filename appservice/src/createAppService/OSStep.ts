/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardStep, IAzureQuickPickItem, IAzureUserInput } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class OSStep extends AzureWizardStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        const picks: IAzureQuickPickItem<WebsiteOS>[] = [
            { label: 'Linux', description: '', data: WebsiteOS.linux },
            { label: 'Windows', description: '', data: WebsiteOS.windows }
        ];

        wizardContext.websiteOS = (await ui.showQuickPick(picks, { placeHolder: localize('selectOS', 'Select an OS.') })).data;

        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext): Promise<IAppServiceWizardContext> {
        return wizardContext;
    }
}
