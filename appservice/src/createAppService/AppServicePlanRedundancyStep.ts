/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SkuDescription } from '@azure/arm-appservice';
import { AzExtLocation } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardPromptStep, IAzureQuickPickItem } from '@microsoft/vscode-azext-utils';
import { localize } from '../localize';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

interface AppServiceWizardContext extends IAppServiceWizardContext {
    _location: AzExtLocation;
    zoneRedundant: boolean;
}

export class AppServicePlanRedundancyStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(context: AppServiceWizardContext): Promise<void> {
        const placeHolder: string = localize('selectZoneRedundancy', 'Select zone redundancy availability');
        const picks: IAzureQuickPickItem<boolean>[] = [
            { label: localize('enabled', 'Enabled'), data: true },
            { label: localize('disabled', 'Disabled'), data: false }
        ];

        context.zoneRedundant = (await context.ui.showQuickPick(picks, { placeHolder })).data;
    }

    // TODO(ccastrotrejo): This will be changed to use orgdomain with WI 12845265 once georegions API is updated with ANT78.
    private isZoneRedundancyEnabled(location: string): boolean {
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

        return zoneRedundancySupportedLocations.includes(location);
    }

    private isAllowedServicePlan(newPlanSku: SkuDescription): boolean {
        const { family } = newPlanSku;
        const allowedServicePlan = [
            'Pv2',
            'Pv3',
            'WS',
        ];

        return !!family && allowedServicePlan.includes(family);
    }

    public shouldPrompt(context: AppServiceWizardContext): boolean {
        const { customLocation, _location, plan, newPlanSku } = context;
        const { name } = _location || {};
        if (plan === undefined && customLocation === undefined && name && newPlanSku) {
            return this.isZoneRedundancyEnabled(name) && this.isAllowedServicePlan(newPlanSku);
        }
        return false;
    }
}
