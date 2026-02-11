/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceGroup } from '@azure/arm-resources';
import { AzureWizardPromptStep, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions, nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { IResourceGroupWizardContext } from './resourceGroupWizardTypes';
import { createResourcesClient } from '../clients';
import { uiUtils } from '../utils/uiUtils';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupCreateStep } from './ResourceGroupCreateStep';
import { ResourceGroupNameStep } from './ResourceGroupNameStep';
import { ResourceGroupVerifyStep } from './ResourceGroupVerifyStep';

export const resourceGroupNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 90,
    // eslint-disable-next-line no-useless-escape
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

export class ResourceGroupListStep<T extends IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    private _suppressCreate: boolean | undefined;

    public constructor(suppressCreate?: boolean) {
        super();
        this._suppressCreate = suppressCreate;
    }

    /**
     * Used to get existing resource groups. By passing in the context, we can ensure that Azure is only queried once for the entire wizard
     * @param wizardContext The context of the wizard.
     */
    public static async getResourceGroups<T extends IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceGroup[]> {
        if (wizardContext.resourceGroupsTask === undefined) {
            const client = await createResourcesClient(wizardContext);
            wizardContext.resourceGroupsTask = uiUtils.listAllIterator(client.resourceGroups.list());
        }

        return await wizardContext.resourceGroupsTask;
    }

    /**
     * Checks existing resource groups in the wizard's subscription to see if the name is available.
     * @param wizardContext The context of the wizard.
     */
    public static async isNameAvailable<T extends IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const resourceGroupsTask: Promise<ResourceGroup[]> = ResourceGroupListStep.getResourceGroups(wizardContext);
        return !(await resourceGroupsTask).some((rg: ResourceGroup) => rg.name !== undefined && rg.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(wizardContext: T): Promise<void> {
        // Cache resource group separately per subscription
        const options: IAzureQuickPickOptions = { placeHolder: 'Select a resource group for new resources.', id: `ResourceGroupListStep/${wizardContext.subscriptionId}` };
        wizardContext.resourceGroup = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
        if (wizardContext.resourceGroup && !LocationListStep.hasLocation(wizardContext) && !LocationListStep.getAutoSelectLocation(wizardContext)) {
            await LocationListStep.setAutoSelectLocation(wizardContext, nonNullProp(wizardContext.resourceGroup, 'location'));
        }
    }

    public async getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined> {
        if (!wizardContext.resourceGroup) {
            const promptSteps: AzureWizardPromptStep<T>[] = [new ResourceGroupNameStep()];
            LocationListStep.addStep(wizardContext, promptSteps);

            return Promise.resolve({
                promptSteps,
                executeSteps: [
                    new ResourceGroupVerifyStep(),
                    new ResourceGroupCreateStep(),
                ],
            });
        } else {
            wizardContext.valuesToMask.push(nonNullProp(wizardContext.resourceGroup, 'name'));
            return Promise.resolve(undefined);
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.resourceGroup && !wizardContext.newResourceGroupName;
    }

    private async getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<ResourceGroup | undefined>[]> {
        const picks: IAzureQuickPickItem<ResourceGroup | undefined>[] = [];

        if (!this._suppressCreate) {
            picks.push({
                label: vscode.l10n.t('$(plus) Create new resource group'),
                description: '',
                data: undefined
            });
        }

        const resourceGroups: ResourceGroup[] = (await ResourceGroupListStep.getResourceGroups(wizardContext)).sort((a, b) => {
            const nameA: string = nonNullProp(a, 'name');
            const nameB: string = nonNullProp(b, 'name');
            if (nameA > nameB) {
                return 1;
            } else if (nameA < nameB) {
                return -1;
            } else {
                return 0;
            }
        });

        return picks.concat(resourceGroups.map((rg: ResourceGroup) => {
            return {
                id: rg.id,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                label: rg.name!,
                description: rg.location,
                data: rg
            };
        }));
    }
}
