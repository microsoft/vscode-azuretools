/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SkuDescription } from 'azure-arm-website/lib/models';
import { AzureWizardPromptStep, IAzureUserInput } from 'vscode-azureextensionui';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanSkuStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        if (!wizardContext.newPlanSku) {
            const pricingTiers: IAzureQuickPickItem<SkuDescription>[] = this.getPlanSkus().map((s: SkuDescription) => {
                return {
                    label: s.name,
                    description: s.tier,
                    data: s
                };
            });

            wizardContext.newPlanSku = (await ui.showQuickPick(pricingTiers, { placeHolder: localize('PricingTierPlaceholder', 'Select a pricing tier for the new App Service plan.') })).data;
        }

        return wizardContext;
    }

    private getPlanSkus(): SkuDescription[] {
        return [
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
            }
        ];
    }
}
