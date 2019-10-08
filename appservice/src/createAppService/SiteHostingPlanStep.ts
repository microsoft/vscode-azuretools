/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem, IWizardOptions } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { WebsiteOS } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class SiteHostingPlanStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        const placeHolder: string = localize('selectHostingPlan', 'Select a hosting plan.');
        const picks: IAzureQuickPickItem<[boolean, RegExp | undefined]>[] = [
            { label: localize('consumption', 'Consumption'), data: [true, undefined] }
        ];

        if (wizardContext.newSiteOS !== WebsiteOS.linux) { // Not supported on linux yet
            picks.push({ label: localize('premium', 'Premium'), data: [false, /^EP/i] });
        }

        picks.push({ label: localize('dedicated', 'App Service Plan'), data: [false, /^[^E]/i] });

        [wizardContext.useConsumptionPlan, wizardContext.planSkuFamilyFilter] = (await ext.ui.showQuickPick(picks, { placeHolder })).data;
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
