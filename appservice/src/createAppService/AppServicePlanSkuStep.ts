/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { GeoRegion, SkuDescription } from '@azure/arm-appservice';
import { LocationListStep, uiUtils } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardPromptStep, IAzureQuickPickItem, nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { createWebSiteClient } from '../utils/azureClients';
import { openUrl } from '../utils/openUrl';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { setLocationsTask } from './setLocationsTask';

type ExtendedSkuDescription = SkuDescription & { label?: string; description?: string; group?: string }

export class AppServicePlanSkuStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(context: IAppServiceWizardContext): Promise<void> {
        let skus: ExtendedSkuDescription[] = [];
        if (await this.isPV4Region(context)) {
            skus = context.advancedCreation ? this.pv4RecommendedSkus().concat(this.getAdvancedSkus()) : this.pv4RecommendedSkus();
        } else {
            skus = context.advancedCreation ? this.nonPV4RecommendedSkus().concat(this.getAdvancedSkus()) : this.nonPV4RecommendedSkus();
        }

        if (context.newSiteKind === AppKind.functionapp) {
            skus.push(...this.getElasticPremiumSkus());
        } else if (context.newSiteKind?.includes(AppKind.workflowapp)) {
            skus = this.getWorkflowStandardSkus();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (context['newSiteJavaStack']?.majorVersion?.value === 'jbosseap') {
            // for jboss eap, only Pv3 plan is supported
            skus = this.getPremiumV3Skus();
        }

        const regExp: RegExp | undefined = context.planSkuFamilyFilter;
        if (regExp) {
            skus = skus.filter(s => !s.family || regExp.test(s.family));
        }

        const pricingTiers: IAzureQuickPickItem<SkuDescription | undefined>[] = skus.map(s => {
            return {
                label: s.label || nonNullProp(s, 'name'),
                description: s.description,
                data: s,
                group: s.group || vscode.l10n.t('Additional Options')
            };
        });

        pricingTiers.push({ label: vscode.l10n.t('$(link-external) Show pricing information...'), data: undefined, suppressPersistence: true });

        while (!context.newPlanSku) {
            const placeHolder = vscode.l10n.t('Select a pricing tier');
            context.newPlanSku = (await context.ui.showQuickPick(pricingTiers, { placeHolder, suppressPersistence: true, enableGrouping: context.advancedCreation })).data;

            if (!context.newPlanSku) {
                if (context.newSiteOS === WebsiteOS.linux) {
                    await openUrl('https://aka.ms/AA60znj');
                } else {
                    await openUrl('https://aka.ms/AA6202c');
                }
            }
        }

        await setLocationsTask(context);
    }

    public shouldPrompt(context: IAppServiceWizardContext): boolean {
        return !context.newPlanSku;
    }

    private async isPV4Region(context: IAppServiceWizardContext): Promise<boolean> {
        const client = await createWebSiteClient(context);
        const geoRegions: GeoRegion[] = await uiUtils.listAllIterator(client.listGeoRegions());
        const pv4Regions = geoRegions.filter((region: GeoRegion) => region.orgDomain?.includes('PV4SERIES'));
        if (LocationListStep.hasLocation(context)) {
            const location = await LocationListStep.getLocation(context);
            if (pv4Regions.some(region => region.displayName === location.displayName)) {
                return true;
            } else {
                return false;
            }
        }

        return false;
    }

    private pv4RecommendedSkus(): ExtendedSkuDescription[] {
        const recommendedGroup: string = vscode.l10n.t('Recommended');
        return [
            {
                name: 'F1',
                tier: 'Free',
                size: 'F1',
                family: 'F',
                capacity: 1,
                label: vscode.l10n.t('Free (F1)'),
                description: vscode.l10n.t('Try out Azure at no cost'),
                group: recommendedGroup
            },
            {
                name: 'B1',
                tier: 'Basic',
                size: 'B1',
                family: 'B',
                capacity: 1,
                label: vscode.l10n.t('Basic (B1)'),
                description: vscode.l10n.t('Develop and test'),
                group: recommendedGroup
            },
            {
                name: 'P0V4',
                tier: 'Premium V4',
                size: 'P0V4',
                family: 'Pv4',
                capacity: 1,
                label: vscode.l10n.t('Premium V4 (P0V4)'),
                group: recommendedGroup
            },
            {
                name: 'P1V4',
                tier: 'Premium V4',
                size: 'P1V4',
                family: 'Pv4',
                capacity: 1,
                label: vscode.l10n.t('Premium V4 (P1V4)'),
                group: recommendedGroup
            },
            {
                name: 'P1MV4',
                tier: 'Premium V4',
                size: 'P1MV4',
                family: 'Pv4',
                capacity: 1,
                label: vscode.l10n.t('Premium V4 (P1MV4)'),
                group: recommendedGroup
            },
            {
                name: 'P0V3',
                tier: 'Premium V3',
                size: 'P0V3',
                family: 'Pv3',
                capacity: 1,
                label: vscode.l10n.t('Premium V3 (P0V3)'),
                group: recommendedGroup
            },
            {
                name: 'P1V3',
                tier: 'Premium V3',
                size: 'P1V3',
                family: 'Pv3',
                capacity: 1,
                label: vscode.l10n.t('Premium V3 (P1V3)'),
                group: recommendedGroup
            },
            {
                name: 'P1MV3',
                tier: 'Premium V3',
                size: 'P1MV3',
                family: 'Pv3',
                capacity: 1,
                label: vscode.l10n.t('Premium V3 (P1MV3)'),
                group: recommendedGroup
            }
        ]
    }

    private nonPV4RecommendedSkus(): ExtendedSkuDescription[] {
        const recommendedGroup: string = vscode.l10n.t('Recommended');
        return [
            {
                name: 'F1',
                tier: 'Free',
                size: 'F1',
                family: 'F',
                capacity: 1,
                label: vscode.l10n.t('Free (F1)'),
                description: vscode.l10n.t('Try out Azure at no cost'),
                group: recommendedGroup
            },
            {
                name: 'B1',
                tier: 'Basic',
                size: 'B1',
                family: 'B',
                capacity: 1,
                label: vscode.l10n.t('Basic (B1)'),
                description: vscode.l10n.t('Develop and test'),
                group: recommendedGroup
            },
            {
                name: 'P0V3',
                tier: 'Premium V3',
                size: 'P0V3',
                family: 'Pv3',
                capacity: 1,
                label: vscode.l10n.t('Premium V3 (P0V3)'),
                group: recommendedGroup
            },
            {
                name: 'P1V3',
                tier: 'Premium V3',
                size: 'P1V3',
                family: 'Pv3',
                capacity: 1,
                label: vscode.l10n.t('Premium V3 (P1V3)'),
                group: recommendedGroup
            },
            {
                name: 'P1MV3',
                tier: 'Premium V3',
                size: 'P1MV3',
                family: 'Pv3',
                capacity: 1,
                label: vscode.l10n.t('Premium V3 (P1MV3)'),
                group: recommendedGroup
            }
        ]
    }

    private getAdvancedSkus(): SkuDescription[] {
        return [
            {
                name: 'Basic (B2)',
                tier: 'Basic',
                size: 'B2',
                family: 'B',
                capacity: 1
            },
            {
                name: 'Basic (B3)',
                tier: 'Basic',
                size: 'B3',
                family: 'B',
                capacity: 1
            },
            {
                name: 'Standard (S1)',
                tier: 'Standard',
                size: 'S1',
                family: 'S',
                capacity: 1
            },
            {
                name: 'Standard (S2)',
                tier: 'Standard',
                size: 'S2',
                family: 'S',
                capacity: 1
            },
            {
                name: 'Standard (S3)',
                tier: 'Standard',
                size: 'S3',
                family: 'S',
                capacity: 1
            },
            {
                name: 'Premium V2 (P2v2)',
                tier: 'Premium V2',
                size: 'P2v2',
                family: 'Pv2',
                capacity: 1
            },
            {
                name: 'Premium V2 (P3v2)',
                tier: 'Premium V2',
                size: 'P3v2',
                family: 'Pv2',
                capacity: 1
            }
        ];
    }

    private getPremiumV3Skus(): SkuDescription[] {
        return [
            {
                name: 'Premium V3 (P1v3)',
                tier: 'Premium V3',
                size: 'P1v3',
                family: 'Pv3',
                capacity: 1
            },
            {
                name: 'Premium V3 (P2v3)',
                tier: 'Premium V3',
                size: 'P2v3',
                family: 'Pv3',
                capacity: 1
            },
            {
                name: 'Premium V3 (P3v3)',
                tier: 'Premium V3',
                size: 'P3v3',
                family: 'Pv3',
                capacity: 1
            }
        ];
    }

    private getElasticPremiumSkus(): SkuDescription[] {
        return [
            {
                name: 'Elastic Premium (EP1)',
                tier: 'Elastic Premium',
                size: 'EP1',
                family: 'EP',
                capacity: 1
            },
            {
                name: 'Elastic Premium (EP2)',
                tier: 'Elastic Premium',
                size: 'EP2',
                family: 'EP',
                capacity: 1
            },
            {
                name: 'Elastic Premium (EP3)',
                tier: 'Elastic Premium',
                size: 'EP3',
                family: 'EP',
                capacity: 1
            }
        ];
    }

    private getWorkflowStandardSkus(): SkuDescription[] {
        return [
            {
                name: 'Workflow Standard WS1',
                tier: 'Workflow Standard',
                size: 'WS1',
                family: 'WS',
                capacity: 1
            },
            {
                name: 'Workflow Standard WS2',
                tier: 'Workflow Standard',
                size: 'WS2',
                family: 'WS',
                capacity: 1
            },
            {
                name: 'Workflow Standard WS3',
                tier: 'Workflow Standard',
                size: 'WS3',
                family: 'WS',
                capacity: 1
            }
        ];
    }
}
