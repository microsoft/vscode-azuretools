/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SkuDescription } from '@azure/arm-appservice';
import { AzExtLocation } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardPromptStep, IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

interface AppServiceWizardContext extends IAppServiceWizardContext {
    _location: AzExtLocation;
    zoneRedundant: boolean;
}

export class AppServicePlanRedundancyStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(context: AppServiceWizardContext): Promise<void> {
        const placeHolder: string = vscode.l10n.t('Select zone redundancy availability');
        const picks: IAzureQuickPickItem<boolean>[] = [
            { label: vscode.l10n.t('Enabled'), data: true },
            { label: vscode.l10n.t('Disabled'), data: false }
        ];

        context.zoneRedundant = (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    // TODO(ccastrotrejo): This will be changed to use orgdomain with WI 12845265 once georegions API is updated with ANT78.
    public static isZoneRedundancySupportedLocation(location: string): boolean {
        const zoneRedundancySupportedLocations = [
            'westus2',
            'westus3',
            'centralus',
            'eastus',
            'eastus2',
            'canadacentral',
            'brazilsouth',
            'northeurope',
            'westeurope',
            'germanywestcentral',
            'francecentral',
            'uksouth',
            'japaneast',
            'southeastasia',
            'australiaeast',
            'eastus2euap',
        ];

        location = location.replace(/\s/, "").toLowerCase();
        return zoneRedundancySupportedLocations.includes(location);
    }

    public static isZoneRedundancySupportedServicePlan(newPlanSku: SkuDescription | string): boolean {
        const allowedServicePlans: string[] = [
            'Pv2',
            'Pv3',
            'WS',
        ];

        let plan: string;
        if ((newPlanSku as SkuDescription)?.family) {
            // Nullish coallescing operator should be logically unnecessary, but helps TS compiler understand that this value won't be undefined
            plan = (newPlanSku as SkuDescription).family ?? '';
        } else {
            plan = newPlanSku as string;
        }

        return allowedServicePlans.includes(plan);
    }

    public static isZoneRedundancySupported(location: string, newPlanSku: SkuDescription | string): boolean {
        return this.isZoneRedundancySupportedLocation(location) && this.isZoneRedundancySupportedServicePlan(newPlanSku);
    }

    public shouldPrompt(context: AppServiceWizardContext): boolean {
        const { customLocation, _location, plan, newPlanSku } = context;
        const { name } = _location || {};
        if (plan === undefined && customLocation === undefined && name && newPlanSku) {
            return AppServicePlanRedundancyStep.isZoneRedundancySupported(name, newPlanSku)
        }
        return false;
    }
}
