/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { setLocationsTask } from './setLocationsTask';

type ExtendedSkuDescription = WebSiteManagementModels.SkuDescription & { label?: string; description?: string }

export class AppServicePlanSkuStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        let skus: ExtendedSkuDescription[] = wizardContext.advancedCreation ? this.getRecommendedSkus().concat(this.getAdvancedSkus()) : this.getRecommendedSkus();
        if (wizardContext.newSiteKind === AppKind.functionapp) {
            skus.push(...this.getElasticPremiumSkus());
        } else if (wizardContext.newSiteKind?.includes(AppKind.workflowapp)) {
            skus = this.getWorkflowStandardSkus();
        }

        const regExp: RegExp | undefined = wizardContext.planSkuFamilyFilter;
        if (regExp) {
            skus = skus.filter(s => !s.family || regExp.test(s.family));
        }

        const pricingTiers: IAzureQuickPickItem<WebSiteManagementModels.SkuDescription | undefined>[] = skus.map(s => {
            return {
                label: s.label || nonNullProp(s, 'name'),
                description: s.description || s.tier,
                data: s,
                group: s.label && s.description ? localize('recommendedLabel', 'Recommended') : localize('additionalOptionsLabel', 'Additional Options')
            };
        });

        pricingTiers.push({ label: localize('ShowPricingCalculator', '$(link-external) Show pricing information...'), data: undefined, suppressPersistence: true });

        while (!wizardContext.newPlanSku) {
            const placeHolder = localize('pricingTierPlaceholder', 'Select a pricing tier');
            wizardContext.newPlanSku = (await wizardContext.ui.showQuickPick(pricingTiers, { placeHolder, suppressPersistence: true, enableGrouping: wizardContext.advancedCreation })).data;

            if (!wizardContext.newPlanSku) {
                if (wizardContext.newSiteOS === WebsiteOS.linux) {
                    await openUrl('https://aka.ms/AA60znj');
                } else {
                    await openUrl('https://aka.ms/AA6202c');
                }
            }
        }

        await setLocationsTask(wizardContext);
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.newPlanSku;
    }

    private getRecommendedSkus(): ExtendedSkuDescription[] {
        return [
            {
                name: 'F1',
                tier: 'Free',
                size: 'F1',
                family: 'F',
                capacity: 1,
                label: localize('freeLabel', 'Free'),
                description: localize('freeDescription', 'Try out Azure at no cost')
            },
            {
                name: 'B1',
                tier: 'Basic',
                size: 'B1',
                family: 'B',
                capacity: 1,
                label: localize('basicLabel', 'Basic'),
                description: localize('basicDescription', 'Develop and test')
            },
            {
                name: 'P1v2',
                tier: 'Premium V2',
                size: 'P1v2',
                family: 'Pv2',
                capacity: 1,
                label: localize('premiumLabel', 'Premium'),
                description: localize('premiumDescription', 'Use in production')
            }
        ];
    }

    private getAdvancedSkus(): WebSiteManagementModels.SkuDescription[] {
        return [
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
            },
            {
                name: 'P1v2',
                tier: 'Premium V2',
                size: 'P1v2',
                family: 'Pv2',
                capacity: 1
            },
            {
                name: 'P2v2',
                tier: 'Premium V2',
                size: 'P2v2',
                family: 'Pv2',
                capacity: 1
            },
            {
                name: 'P3v2',
                tier: 'Premium V2',
                size: 'P3v2',
                family: 'Pv2',
                capacity: 1
            }
        ];
    }

    private getElasticPremiumSkus(): WebSiteManagementModels.SkuDescription[] {
        return [
            {
                name: 'EP1',
                tier: 'Elastic Premium',
                size: 'EP1',
                family: 'EP',
                capacity: 1
            },
            {
                name: 'EP2',
                tier: 'Elastic Premium',
                size: 'EP2',
                family: 'EP',
                capacity: 1
            },
            {
                name: 'EP3',
                tier: 'Elastic Premium',
                size: 'EP3',
                family: 'EP',
                capacity: 1
            }
        ];
    }

    private getWorkflowStandardSkus(): WebSiteManagementModels.SkuDescription[] {
        return [
            {
                name: 'WS1',
                tier: 'Workflow Standard',
                size: 'WS1',
                family: 'WS',
                capacity: 1
            },
            {
                name: 'WS2',
                tier: 'Workflow Standard',
                size: 'WS2',
                family: 'WS',
                capacity: 1
            },
            {
                name: 'WS3',
                tier: 'Workflow Standard',
                size: 'WS3',
                family: 'WS',
                capacity: 1
            }
        ];
    }
}
