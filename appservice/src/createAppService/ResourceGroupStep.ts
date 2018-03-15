/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient, SubscriptionClient } from 'azure-arm-resource';
import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { Location, Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { OutputChannel, QuickPickOptions } from 'vscode';
import { AzureWizardStep, IAzureQuickPickOptions, IAzureUserInput } from 'vscode-azureextensionui';
import { IAzureQuickPickItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class ResourceGroupStep extends AzureWizardStep<IAppServiceWizardContext> {
    private _createNew: boolean;

    private readonly _createNewItem: IAzureQuickPickItem<ResourceGroup> = {
        label: localize('NewResourceGroup', '$(plus) Create New Resource Group'),
        description: null,
        data: null
    };

    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {

        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;

        const resourceClient: ResourceManagementClient = new ResourceManagementClient(credentials, subscription.subscriptionId);
        const resourceGroupsTask: Promise<ResourceGroup[]> = uiUtils.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());

        const client: SubscriptionClient = new SubscriptionClient(credentials);
        const locationsTask: Promise<Location[]> = client.subscriptions.listLocations(subscription.subscriptionId);

        // Cache resource group separately per subscription
        const quickPickOptions: IAzureQuickPickOptions = { placeHolder: 'Select a resource group.', id: `NewWebApp.ResourceGroup/${subscription.id}` };
        const resourceGroup: ResourceGroup = (await ui.showQuickPick(this.getQuickPicks(resourceGroupsTask, locationsTask), quickPickOptions)).data;

        if (resourceGroup) {
            this._createNew = false;
            wizardContext.resourceGroup = resourceGroup;
            return wizardContext;
        }

        this._createNew = true;
        const suggestedName: string = await wizardContext.relatedNameTask;
        const resourceGroups: ResourceGroup[] = await resourceGroupsTask;
        const newRgName: string = await ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter the name of the new resource group.',
            validateInput: (value: string): string | undefined => {
                value = value ? value.trim() : '';

                if (resourceGroups.findIndex((rg: ResourceGroup) => rg.name.localeCompare(value) === 0) >= 0) {
                    return localize('ResourceGroupAlreadyExists', 'Resource group name "{0}" already exists.', value);
                }

                if (!value.match(/^[a-z0-9.\-_()]{0,89}[a-z0-9\-_()]$/ig)) {
                    return localize('ResourceGroupRegExpError', 'Resource group name should be 1-90 characters long and can only include alphanumeric characters, periods, underscores, hyphens and parenthesis and cannot end in a period.');
                }

                return undefined;
            }
        });

        const locations: Location[] = await locationsTask;
        const locationPickItems: IAzureQuickPickItem<Location>[] = locations.map<IAzureQuickPickItem<Location>>((l: Location) => {
            return {
                label: l.displayName,
                description: `(${l.name})`,
                detail: '',
                id: l.name,
                data: l
            };
        });
        const locationPickOptions: QuickPickOptions = { placeHolder: 'Select the location for the new resource group.' };
        const location: Location = (await ui.showQuickPick(locationPickItems, locationPickOptions)).data;

        wizardContext.resourceGroup = {
            name: newRgName.trim(),
            location: location.name
        };

        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext, outputChannel: OutputChannel): Promise<IAppServiceWizardContext> {
        if (!this._createNew) {
            outputChannel.appendLine(localize('UsingResourceGroup', 'Using resource group "{0} ({1})".', wizardContext.resourceGroup.name, wizardContext.resourceGroup.location));
            return wizardContext;
        }

        outputChannel.appendLine(localize('CreatingResourceGroup', 'Creating new resource group "{0} ({1})"...', wizardContext.resourceGroup.name, wizardContext.resourceGroup.location));
        const credentials: ServiceClientCredentials = wizardContext.credentials; const subscription: Subscription = wizardContext.subscription;
        const resourceClient: ResourceManagementClient = new ResourceManagementClient(credentials, subscription.subscriptionId);
        wizardContext.resourceGroup = await resourceClient.resourceGroups.createOrUpdate(wizardContext.resourceGroup.name, wizardContext.resourceGroup);
        outputChannel.appendLine(localize('CreatedResourceGroup', 'Created resource group "{0} ({1})".', wizardContext.resourceGroup.name, wizardContext.resourceGroup.location));
        return wizardContext;
    }

    private async getQuickPicks(resourceGroupsTask: Promise<ResourceGroup[]>, locationsTask: Promise<Location[]>): Promise<IAzureQuickPickItem<ResourceGroup>[]> {
        const [resourceGroups, locations]: [ResourceGroup[], Location[]] = await Promise.all([resourceGroupsTask, locationsTask]);
        return [this._createNewItem].concat(resourceGroups.map((rg: ResourceGroup) => {
            return {
                id: rg.id,
                label: rg.name,
                description: locations.find((l: Location) => l.name.toLowerCase() === rg.location.toLowerCase()).displayName,
                detail: '',
                data: rg
            };
        }));
    }
}
