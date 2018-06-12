/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IAzureUserInput, IResourceGroupWizardContext } from '../../index';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { AzureWizard } from './AzureWizard';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupCreateStep } from './ResourceGroupCreateStep';
import { ResourceGroupNameStep } from './ResourceGroupNameStep';

export const resourceGroupNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 90,
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

export class ResourceGroupListStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    public static async getResourceGroups<T extends IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceGroup[]> {
        if (wizardContext.resourceGroupsTask === undefined) {
            const client: ResourceManagementClient = new ResourceManagementClient(wizardContext.credentials, wizardContext.subscriptionId);
            wizardContext.resourceGroupsTask = uiUtils.listAll(client.resourceGroups, client.resourceGroups.list());
        }

        return await wizardContext.resourceGroupsTask;
    }

    public static async isNameAvailable<T extends IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const resourceGroupsTask: Promise<ResourceGroup[]> = ResourceGroupListStep.getResourceGroups(wizardContext);
        return !(await resourceGroupsTask).some((rg: ResourceGroup) => rg.name !== undefined && rg.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(wizardContext: T, ui: IAzureUserInput): Promise<T> {
        if (!wizardContext.resourceGroup && !wizardContext.newResourceGroupName) {
            // Cache resource group separately per subscription
            const options: IAzureQuickPickOptions = { placeHolder: 'Select a resource group for new resources.', id: `ResourceGroupListStep/${wizardContext.subscriptionId}` };
            wizardContext.resourceGroup = (await ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;

            if (!wizardContext.resourceGroup) {
                this.subWizard = new AzureWizard(
                    [new ResourceGroupNameStep(), new LocationListStep()],
                    [new ResourceGroupCreateStep()],
                    wizardContext
                );
            }
        } else if (!wizardContext.resourceGroup && wizardContext.newResourceGroupName) {
            if (await ResourceGroupListStep.isNameAvailable(wizardContext, wizardContext.newResourceGroupName)) {
                this.subWizard = new AzureWizard([], [new ResourceGroupCreateStep()], wizardContext);
            } else {
                wizardContext.resourceGroup = (await ResourceGroupListStep.getResourceGroups(wizardContext)).find((rg: ResourceGroup) => {
                    return (rg.name === wizardContext.newResourceGroupName);
                });
            }
        }

        return wizardContext;
    }

    private async getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<ResourceGroup | undefined>[]> {
        const picks: IAzureQuickPickItem<ResourceGroup | undefined>[] = [{
            label: localize('NewResourceGroup', '$(plus) Create new resource group'),
            description: '',
            data: undefined
        }];

        const resourceGroups: ResourceGroup[] = await ResourceGroupListStep.getResourceGroups(wizardContext);
        return picks.concat(resourceGroups.map((rg: ResourceGroup) => {
            return {
                id: rg.id,
                // tslint:disable-next-line:no-non-null-assertion
                label: rg.name!,
                description: rg.location,
                data: rg
            };
        }));
    }
}
