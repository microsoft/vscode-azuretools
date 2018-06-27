/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Capability, SkuDescription } from 'azure-arm-website/lib/models';
import { AzureWizardPromptStep, IAzureUserInput } from 'vscode-azureextensionui';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class AppServicePlanSkuStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        if (!wizardContext.newPlanSku) {
            const pricingTiers: IAzureQuickPickItem<SkuDescription>[] = this.getPlanSkus(wizardContext.newSiteOS).map((s: SkuDescription) => {
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

    private getPlanSkus(os: string): SkuDescription[] {
        const skus: SkuDescription[] = [
            {
                name: 'F1',
                tier: 'Free',
                size: 'F1',
                family: 'F',
                capacity: 1,
                capabilities: [{ name: 'supportedOn', value: 'windows' }]
            },
            {
                name: 'B1',
                tier: 'Basic',
                size: 'B1',
                family: 'B',
                capacity: 1,
                capabilities: [{ name: 'supportedOn', value: 'windows,linux' }]
            },
            {
                name: 'B2',
                tier: 'Basic',
                size: 'B2',
                family: 'B',
                capacity: 1,
                capabilities: [{ name: 'supportedOn', value: 'windows,linux' }]
            },
            {
                name: 'B3',
                tier: 'Basic',
                size: 'B3',
                family: 'B',
                capacity: 1,
                capabilities: [{ name: 'supportedOn', value: 'windows,linux' }]
            },
            {
                name: 'S1',
                tier: 'Standard',
                size: 'S1',
                family: 'S',
                capacity: 1,
                capabilities: [{ name: 'supportedOn', value: 'windows,linux' }]
            },
            {
                name: 'S2',
                tier: 'Standard',
                size: 'S2',
                family: 'S',
                capacity: 1,
                capabilities: [{ name: 'supportedOn', value: 'windows,linux' }]
            },
            {
                name: 'S3',
                tier: 'Standard',
                size: 'S3',
                family: 'S',
                capacity: 1,
                capabilities: [{ name: 'supportedOn', value: 'windows,linux' }]
            }
        ];

        // filters the list of SKUs to make sure they suppport the chosen operating system
        return skus.filter((sku: SkuDescription) => {
            return sku.capabilities.find((capability: Capability) => {
                return capability.name === 'supportedOn' && capability.value.indexOf(os) > -1;
            });
        });
    }
}
