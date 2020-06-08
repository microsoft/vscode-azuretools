/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import * as types from '../../index';
import { createAzureClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupCreateStep } from './ResourceGroupCreateStep';
import { ResourceGroupNameStep } from './ResourceGroupNameStep';

export const resourceGroupNamingRules: types.IAzureNamingRules = {
    minLength: 1,
    maxLength: 90,
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

export class ResourceGroupListStep<T extends types.IResourceGroupWizardContext> extends AzureWizardPromptStep<T> implements types.ResourceGroupListStep<T> {
    private _suppressCreate: boolean | undefined;

    public constructor(suppressCreate?: boolean) {
        super();
        this._suppressCreate = suppressCreate;
    }

    public static async getResourceGroups<T extends types.IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceGroup[]> {
        if (wizardContext.resourceGroupsTask === undefined) {
            const client: ResourceManagementClient = createAzureClient(wizardContext, ResourceManagementClient);
            wizardContext.resourceGroupsTask = uiUtils.listAll(client.resourceGroups, client.resourceGroups.list());
        }

        return await wizardContext.resourceGroupsTask;
    }

    public static async isNameAvailable<T extends types.IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const resourceGroupsTask: Promise<ResourceGroup[]> = ResourceGroupListStep.getResourceGroups(wizardContext);
        return !(await resourceGroupsTask).some((rg: ResourceGroup) => rg.name !== undefined && rg.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(wizardContext: T): Promise<void> {
        // Cache resource group separately per subscription
        const options: types.IAzureQuickPickOptions = { placeHolder: 'Select a resource group for new resources.', id: `ResourceGroupListStep/${wizardContext.subscriptionId}` };
        wizardContext.resourceGroup = (await ext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public async getSubWizard(wizardContext: T): Promise<types.IWizardOptions<T> | undefined> {
        if (!wizardContext.resourceGroup) {
            const promptSteps: AzureWizardPromptStep<T>[] = [new ResourceGroupNameStep()];
            LocationListStep.addStep(wizardContext, promptSteps);

            return {
                promptSteps,
                executeSteps: [new ResourceGroupCreateStep()]
            };
        } else {
            return undefined;
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.resourceGroup && !wizardContext.newResourceGroupName;
    }

    private async getQuickPicks(wizardContext: T): Promise<types.IAzureQuickPickItem<ResourceGroup | undefined>[]> {
        let picks: types.IAzureQuickPickItem<ResourceGroup | undefined>[] = [];

        if (!this._suppressCreate) {
            picks.push({
                label: localize('NewResourceGroup', '$(plus) Create new resource group'),
                description: '',
                data: undefined
            });
        }

        const resourceGroups: ResourceGroup[] = await ResourceGroupListStep.getResourceGroups(wizardContext);
        picks = picks.concat(resourceGroups.map((rg: ResourceGroup) => {
            return {
                id: rg.id,
                // tslint:disable-next-line:no-non-null-assertion
                label: rg.name!,
                description: rg.location,
                data: rg
            };
        }));

        return picks.sort((a, b) => {
            if (a.label > b.label) {
                return 1;
            } else if (a.label < b.label) {
                return -1;
            } else {
                return 0;
            }
        });
    }
}
