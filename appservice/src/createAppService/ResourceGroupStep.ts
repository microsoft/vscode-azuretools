/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient, SubscriptionClient } from 'azure-arm-resource';
import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { Location, Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { QuickPickOptions } from 'vscode';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { IQuickPickItemWithData } from '../wizard/IQuickPickItemWithData';
import { WizardStep } from '../wizard/WizardStep';
import { AppServiceCreator } from './AppServiceCreator';

export class ResourceGroupStep extends WizardStep {
    protected readonly wizard: AppServiceCreator;

    private _createNew: boolean;
    private _rg: ResourceGroup;
    private readonly _createNewItem: IQuickPickItemWithData<ResourceGroup> = {
        persistenceId: '',
        label: localize('NewResourceGroup', '$(plus) Create New Resource Group'),
        description: null,
        data: null
    };

    constructor(wizard: AppServiceCreator) {
        super(wizard);
    }

    public async prompt(): Promise<void> {
        const quickPickOptions: QuickPickOptions = { placeHolder: `Select a resource group. (${this.stepProgressText})` };

        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;

        const resourceClient: ResourceManagementClient = new ResourceManagementClient(credentials, subscription.subscriptionId);
        const resourceGroupsTask: Promise<ResourceGroup[]> = uiUtils.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());

        const client: SubscriptionClient = new SubscriptionClient(credentials);
        const locationsTask: Promise<Location[]> = client.subscriptions.listLocations(subscription.subscriptionId);

        // Cache resource group separately per subscription
        const resourceGroup: ResourceGroup = await this.showQuickPick(this.getQuickPicks(resourceGroupsTask, locationsTask), quickPickOptions, `"NewWebApp.ResourceGroup/${subscription.id}`);

        if (resourceGroup) {
            this._createNew = false;
            this._rg = resourceGroup;
            return;
        }

        this._createNew = true;
        const suggestedName: string = await this.wizard.websiteNameStep.computeRelatedName();
        const resourceGroups: ResourceGroup[] = await resourceGroupsTask;
        const newRgName: string = await this.showInputBox({
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
        const locationPickItems: IQuickPickItemWithData<Location>[] = locations.map<IQuickPickItemWithData<Location>>((l: Location) => {
            return {
                label: l.displayName,
                description: `(${l.name})`,
                detail: '',
                persistenceId: l.name,
                data: l
            };
        });
        const locationPickOptions: QuickPickOptions = { placeHolder: 'Select the location for the new resource group.' };
        const location: Location = await this.showQuickPick(locationPickItems, locationPickOptions, 'NewWebApp.Location');

        this._rg = {
            name: newRgName.trim(),
            location: location.name
        };
    }

    public async execute(): Promise<void> {
        if (!this._createNew) {
            this.wizard.writeline(localize('UsingResourceGroup', 'Using resource group "{0} ({1})".', this._rg.name, this._rg.location));
            return;
        }

        this.wizard.writeline(localize('CreatingResourceGroup', 'Creating new resource group "{0} ({1})"...', this._rg.name, this._rg.location));
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials; const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const resourceClient: ResourceManagementClient = new ResourceManagementClient(credentials, subscription.subscriptionId);
        this._rg = await resourceClient.resourceGroups.createOrUpdate(this._rg.name, this._rg);
        this.wizard.writeline(localize('CreatedResourceGroup', 'Created resource group "{0} ({1})".', this._rg.name, this._rg.location));
    }

    get resourceGroup(): ResourceGroup {
        return this._rg;
    }

    get createNew(): boolean {
        return this._createNew;
    }

    private async getQuickPicks(resourceGroupsTask: Promise<ResourceGroup[]>, locationsTask: Promise<Location[]>): Promise<IQuickPickItemWithData<ResourceGroup>[]> {
        const [resourceGroups, locations]: [ResourceGroup[], Location[]] = await Promise.all([resourceGroupsTask, locationsTask]);
        return [this._createNewItem].concat(resourceGroups.map((rg: ResourceGroup) => {
            return {
                persistenceId: rg.id,
                label: rg.name,
                description: locations.find((l: Location) => l.name.toLowerCase() === rg.location.toLowerCase()).displayName,
                detail: '',
                data: rg
            };
        }));
    }
}
