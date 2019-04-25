/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem, IWizardOptions } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class SiteHostingPlanStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const placeHolder: string = localize('selectHostingPlan', 'Select a hosting plan.');
        const picks: IAzureQuickPickItem<boolean>[] = [
            { label: localize('consumption', 'Consumption Plan'), data: true },
            { label: localize('dedicated', 'App Service Plan'), data: false }
        ];
        wizardContext.useConsumptionPlan = (await ext.ui.showQuickPick(picks, { placeHolder })).data;
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return wizardContext.useConsumptionPlan === undefined;
    }

    public async getSubWizard(wizardContext: IAppServiceWizardContext): Promise<IWizardOptions<IAppServiceWizardContext> | undefined> {
        if (!wizardContext.useConsumptionPlan) {
            return { promptSteps: [new AppServicePlanListStep()] };
        } else {
            return undefined;
        }
    }
}
