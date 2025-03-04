/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceGroup, ResourceManagementClient } from '@azure/arm-resources';
import { AzureWizardPromptStep, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions, nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { uiUtils } from '../utils/uiUtils';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupCreateStep } from './ResourceGroupCreateStep';
import { ResourceGroupNameStep } from './ResourceGroupNameStep';

export const resourceGroupNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 90,
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

export type ResourceGroupListStepOptions = {
    suppressPersistence?: boolean;
    pickUpdateStrategy?: ResourceGroupPickUpdateStrategy;
};

export type ResourceGroupPick = IAzureQuickPickItem<ResourceGroup>;

export interface ResourceGroupPickUpdateStrategy {
    updatePicks(context: types.IResourceGroupWizardContext, picks: ResourceGroupPick[]): ResourceGroupPick[] | Promise<ResourceGroupPick[]>;
}

export class ResourceGroupListStep<T extends types.IResourceGroupWizardContext> extends AzureWizardPromptStep<T> implements types.ResourceGroupListStep<T> {
    private _suppressCreate: boolean | undefined;

    public constructor(suppressCreate?: boolean, readonly options: ResourceGroupListStepOptions = {}) {
        super();
        this._suppressCreate = suppressCreate;
    }

    public static async getResourceGroups<T extends types.IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceGroup[]> {
        if (wizardContext.resourceGroupsTask === undefined) {
            const client: ResourceManagementClient = await createResourcesClient(wizardContext);
            wizardContext.resourceGroupsTask = uiUtils.listAllIterator(client.resourceGroups.list());
        }

        return await wizardContext.resourceGroupsTask;
    }

    public static async isNameAvailable<T extends types.IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const resourceGroupsTask: Promise<ResourceGroup[]> = ResourceGroupListStep.getResourceGroups(wizardContext);
        return !(await resourceGroupsTask).some((rg: ResourceGroup) => rg.name !== undefined && rg.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(wizardContext: T): Promise<void> {
        // Cache resource group separately per subscription
        const options: IAzureQuickPickOptions = {
            id: `ResourceGroupListStep/${wizardContext.subscriptionId}`,
            placeHolder: vscode.l10n.t('Select a resource group for new resources.'),
            suppressPersistence: this.options.suppressPersistence,
            enableGrouping: true,
        };
        wizardContext.resourceGroup = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
        if (wizardContext.resourceGroup && !LocationListStep.hasLocation(wizardContext)) {
            await LocationListStep.setLocation(wizardContext, nonNullProp(wizardContext.resourceGroup, 'location'));
        }
    }

    public async getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined> {
        if (!wizardContext.resourceGroup) {
            const promptSteps: AzureWizardPromptStep<T>[] = [new ResourceGroupNameStep()];
            LocationListStep.addStep(wizardContext, promptSteps);

            return {
                promptSteps,
                executeSteps: [new ResourceGroupCreateStep()]
            };
        } else {
            wizardContext.valuesToMask.push(nonNullProp(wizardContext.resourceGroup, 'name'));
            return undefined;
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.resourceGroup && !wizardContext.newResourceGroupName;
    }

    private async getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<ResourceGroup | undefined>[]> {
        const rgPicks: IAzureQuickPickItem<ResourceGroup>[] = (await ResourceGroupListStep.getResourceGroups(wizardContext))
            .sort((a, b) => {
                const nameA: string = nonNullProp(a, 'name');
                const nameB: string = nonNullProp(b, 'name');
                if (nameA > nameB) {
                    return 1;
                } else if (nameA < nameB) {
                    return -1;
                } else {
                    return 0;
                }
            })
            .map(rg => {
                return {
                    id: rg.id,
                    label: nonNullProp(rg, 'name'),
                    description: rg.location,
                    data: rg,
                };
            });

        const picks: IAzureQuickPickItem<ResourceGroup | undefined>[] = await this.options.pickUpdateStrategy?.updatePicks(wizardContext, rgPicks) ?? rgPicks;
        if (!this._suppressCreate) {
            picks.unshift({
                label: vscode.l10n.t('$(plus) Create new resource group'),
                description: '',
                data: undefined
            });
        }

        return picks;
    }
}
