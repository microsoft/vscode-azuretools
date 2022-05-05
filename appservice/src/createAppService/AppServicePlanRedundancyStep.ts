/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem, AzExtLocation } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

interface AppServiceWizardContext extends IAppServiceWizardContext {
    _location: AzExtLocation;
    zoneRedundancy: boolean;
}

export class AppServicePlanRedundancyStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(context: AppServiceWizardContext): Promise<void> {
        const placeHolder: string = localize('selectZoneRedundancy', 'Select zone redundancy availability');
        const picks: IAzureQuickPickItem<boolean>[] = [
            { label: localize('enabled', 'Enabled'), data: true },
            { label: localize('disabled', 'Disabled'), data: false }
        ];

        context.zoneRedundancy = (await context.ui.showQuickPick(picks, { placeHolder })).data;
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

    public shouldPrompt(context: AppServiceWizardContext): boolean {
        const { customLocation, _location, plan } = context;
        if (plan === undefined && customLocation === undefined && _location && _location.name) {
            return this.isZoneRedundancyEnabled(context._location.name);
        }
        return false;
    }
}
