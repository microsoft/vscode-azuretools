/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SkuDescription } from 'azure-arm-website/lib/models';
import { AzureWizardPromptStep } from 'vscode-azureextensionui';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanSkuStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        let pricingTiers: IAzureQuickPickItem<SkuDescription>[] = this.getPlanSkus().map((s: SkuDescription) => {
            return {
                label: nonNullProp(s, 'name'),
                description: s.tier,
                data: s
            };
        });

        if (wizardContext.newSiteOS === WebsiteOS.linux) {
            // Free tier is not supported for Linux asp's
            pricingTiers = pricingTiers.filter((plan: IAzureQuickPickItem<SkuDescription>) => {
                return plan.description !== 'Free';
            });
        }

        wizardContext.newPlanSku = (await ext.ui.showQuickPick(pricingTiers, { placeHolder: localize('PricingTierPlaceholder', 'Select a pricing tier for the new App Service plan.') })).data;
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.newPlanSku;
    }

    private getPlanSkus(): SkuDescription[] {
        return [
            {
                name: 'F1',
                tier: 'Free',
                size: 'F1',
                family: 'F',
                capacity: 1
            },
            {
                name: 'B1',
                tier: 'Basic',
                size: 'B1',
                family: 'B',
                capacity: 1
            },
            {
                name: 'B2',
                tier: 'Basic',
                size: 'B2',
                family: 'B',
                capacity: 1
            },
            {
                name: 'B3',
                tier: 'Basic',
                size: 'B3',
                family: 'B',
                capacity: 1
            },
            {
                name: 'S1',
                tier: 'Standard',
                size: 'S1',
                family: 'S',
                capacity: 1
            },
            {
                name: 'S2',
                tier: 'Standard',
                size: 'S2',
                family: 'S',
                capacity: 1
            },
            {
                name: 'S3',
                tier: 'Standard',
                size: 'S3',
                family: 'S',
                capacity: 1
            }
        ];
    }
}
