/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { OutputChannel } from 'vscode';
import { IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IAzureUserInput, IResourceGroupWizardContext } from '../../index';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { AzureWizardStep } from './AzureWizardStep';

export const resourceGroupNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 90,
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

export class ResourceGroupStep<T extends IResourceGroupWizardContext> extends AzureWizardStep<T> {
    private _newName: string;

    public static async getResouceGroups<T extends IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceGroup[]> {
        if (wizardContext.resourceGroupsTask === undefined) {
            // tslint:disable-next-line:no-non-null-assertion
            const client: ResourceManagementClient = new ResourceManagementClient(wizardContext.credentials, wizardContext.subscription.subscriptionId!);
            wizardContext.resourceGroupsTask = uiUtils.listAll(client.resourceGroups, client.resourceGroups.list());
        }

        return await wizardContext.resourceGroupsTask;
    }

    public static async isNameAvailable<T extends IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const resourceGroupsTask: Promise<ResourceGroup[]> = ResourceGroupStep.getResouceGroups(wizardContext);
        return !(await resourceGroupsTask).some((rg: ResourceGroup) => rg.name !== undefined && rg.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(wizardContext: T, ui: IAzureUserInput): Promise<T> {
        // Cache resource group separately per subscription
        const options: IAzureQuickPickOptions = { placeHolder: 'Select a resource group for new resources.', id: `ResourceGroupStep/${wizardContext.subscription.subscriptionId}` };
        wizardContext.resourceGroup = (await ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;

        if (!wizardContext.resourceGroup) {
            const suggestedName: string | undefined = wizardContext.relatedNameTask ? await wizardContext.relatedNameTask : undefined;
            this._newName = (await ui.showInputBox({
                value: suggestedName,
                prompt: 'Enter the name of the new resource group.',
                validateInput: async (value: string | undefined): Promise<string | undefined> => await this.validateResourceGroupName(wizardContext, value)
            })).trim();
        }

        return wizardContext;
    }

    public async execute(wizardContext: T, outputChannel: OutputChannel): Promise<T> {
        if (wizardContext.resourceGroup) {
            outputChannel.appendLine(localize('UsingResourceGroup', 'Using resource group "{0}" in location "{1}".', wizardContext.resourceGroup.name, wizardContext.resourceGroup.location));
        } else {
            // tslint:disable-next-line:no-non-null-assertion
            const newLocation: string = wizardContext.location!.name!;
            outputChannel.appendLine(localize('CreatingResourceGroup', 'Creating resource group "{0}" in location "{1}"...', this._newName, newLocation));
            // tslint:disable-next-line:no-non-null-assertion
            const resourceClient: ResourceManagementClient = new ResourceManagementClient(wizardContext.credentials, wizardContext.subscription.subscriptionId!);
            wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(this._newName, { location: newLocation });
            outputChannel.appendLine(localize('CreatedResourceGroup', 'Successfully created resource group "{0}".', this._newName));
        }

        return wizardContext;
    }

    private async getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<ResourceGroup | undefined>[]> {
        const picks: IAzureQuickPickItem<ResourceGroup | undefined>[] = [{
            label: localize('NewResourceGroup', '$(plus) Create new resource group'),
            description: '',
            data: undefined
        }];

        const resourceGroups: ResourceGroup[] = await ResourceGroupStep.getResouceGroups(wizardContext);
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

    private async validateResourceGroupName(wizardContext: T, name: string | undefined): Promise<string | undefined> {
        name = name ? name.trim() : '';

        if (name.length < resourceGroupNamingRules.minLength || name.length > resourceGroupNamingRules.maxLength) {
            return localize('invalidLength', 'The name must be between {0} and {1} characters.', resourceGroupNamingRules.minLength, resourceGroupNamingRules.maxLength);
        } else if (name.match(resourceGroupNamingRules.invalidCharsRegExp) !== null) {
            return localize('invalidChars', "The name can only contain alphanumeric characters or the symbols ._-()");
        } else if (name.endsWith('.')) {
            return localize('invalidEndingChar', "The name cannot end in a period.");
        } else if (!await ResourceGroupStep.isNameAvailable(wizardContext, name)) {
            return localize('nameAlreadyExists', 'Resource group "{0}" already exists in subscription "{1}".', name, wizardContext.subscription.displayName);
        } else {
            return undefined;
        }
    }
}
