/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { createGenericClient } from '../createAzureClient';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';

function generalizeLocationName(name: string | undefined): string {
    return (name || '')
        .toLowerCase()
        .replace(/\([^\)]*\)/g, '') // remove parentheticals, like in "North Central US (Stage)"
        .replace(/[^a-z0-9]/g, ''); // remove anything else other than letters/numbers
}

interface ILocationWizardContextInternal extends types.ILocationWizardContext {
    /**
     * The task used to get locations.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    _allLocationsTask?: Promise<types.AzExtLocation[]>;

    _alreadyHasLocationStep?: boolean;
}

export class LocationListStep<T extends ILocationWizardContextInternal> extends AzureWizardPromptStep<T> {

    protected constructor() {
        super();
    }

    public static addStep<T extends ILocationWizardContextInternal>(wizardContext: types.IActionContext & Partial<ILocationWizardContextInternal>, promptSteps: AzureWizardPromptStep<T>[]): void {
        if (!wizardContext._alreadyHasLocationStep) {
            promptSteps.push(new this());
            wizardContext._alreadyHasLocationStep = true;
        }
    }

    public static async setLocation<T extends ILocationWizardContextInternal>(wizardContext: T, name: string): Promise<void> {
        const locations: types.AzExtLocation[] = await LocationListStep.getLocations(wizardContext);
        name = generalizeLocationName(name);
        wizardContext.location = locations.find(l => {
            return name === generalizeLocationName(l.name) || name === generalizeLocationName(l.displayName);
        });
    }

    public static async getLocations<T extends ILocationWizardContextInternal>(wizardContext: T): Promise<types.AzExtLocation[]> {
        if (wizardContext._allLocationsTask === undefined) {
            wizardContext._allLocationsTask = getAllLocations(wizardContext);
        }

        const allLocations = await wizardContext._allLocationsTask;
        if (wizardContext.locationsTask === undefined) {
            return allLocations;
        } else {
            const locationsSubset: { name?: string }[] = await wizardContext.locationsTask;
            return allLocations.filter(l1 => locationsSubset.find(l2 => generalizeLocationName(l1.name) === generalizeLocationName(l2.name)));
        }
    }

    public async prompt(wizardContext: T): Promise<void> {
        const options: types.IAzureQuickPickOptions = { placeHolder: localize('selectLocation', 'Select a location for new resources.'), enableGrouping: true };
        wizardContext.location = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.location;
    }

    protected async getQuickPicks(wizardContext: T): Promise<types.IAzureQuickPickItem<types.AzExtLocation>[]> {
        let locations: types.AzExtLocation[] = await LocationListStep.getLocations(wizardContext);
        locations = locations.sort(compareLocation);

        return locations.map(l => {
            return {
                label: nonNullProp(l, 'displayName'),
                group: l.metadata?.regionCategory,
                data: l
            };
        });
    }
}

async function getAllLocations(wizardContext: ILocationWizardContextInternal): Promise<types.AzExtLocation[]> {
    // NOTE: Using a generic client because the subscriptions sdk is pretty far behind on api-version
    const client = await createGenericClient(wizardContext);
    const response = await client.sendRequest({
        method: 'GET',
        url: `/subscriptions/${wizardContext.subscriptionId}/locations?api-version=2019-11-01`
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    let locations: types.AzExtLocation[] = <types.AzExtLocation[]>response.parsedBody.value;
    locations = locations.filter(l => l.metadata?.regionType?.toLowerCase() === 'physical');

    // Filter out any region where the user can't create resource groups - the bare minimum needed for all our wizards
    const rgClient = await createResourcesClient(wizardContext);
    const provider = await rgClient.providers.get('microsoft.resources');
    const rgType = provider.resourceTypes?.find(rt => rt.resourceType?.toLowerCase() === 'resourcegroups');
    locations = locations.filter(l1 => rgType?.locations?.find(l2 => generalizeLocationName(l1.name) === generalizeLocationName(l2)));

    return locations;
}

function compareLocation(l1: types.AzExtLocation, l2: types.AzExtLocation): number {
    if (!isRecommended(l1) && isRecommended(l2)) {
        return 1;
    } else if (isRecommended(l1) && !isRecommended(l2)) {
        return -1;
    } else {
        return 0; // use the default order returned by the API
    }
}

function isRecommended(l: types.AzExtLocation): boolean {
    return l.metadata?.regionCategory?.toLowerCase() === 'recommended';
}
