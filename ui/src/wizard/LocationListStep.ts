/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { resourcesProvider } from '../constants';
import { createGenericClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';

interface ILocationWizardContextInternal extends types.ILocationWizardContext {
    /**
     * The task used to get locations.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    _allLocationsTask?: Promise<types.AzExtLocation[]>;

    _alreadyHasLocationStep?: boolean;

    /**
     * Map of the provider (i.e. 'Microsoft.Web') to it's supported locations
     */
    _providerLocationsMap?: Map<string, Promise<string[]>>;

    /**
     * The selected location. There's a small chance it's not supported by all providers if `setLocation` was used
     */
    _location?: types.AzExtLocation;
}

export class LocationListStep<T extends ILocationWizardContextInternal> extends AzureWizardPromptStep<T> {
    protected constructor() {
        super();
    }

    public static addStep<T extends ILocationWizardContextInternal>(wizardContext: T, promptSteps: AzureWizardPromptStep<T>[]): void {
        if (!wizardContext._alreadyHasLocationStep) {
            promptSteps.push(new this());
            wizardContext._alreadyHasLocationStep = true;
            this.getInternalVariables(wizardContext); // initialize
        }
    }

    private static getInternalVariables<T extends ILocationWizardContextInternal>(wizardContext: T): [Promise<types.AzExtLocation[]>, Map<string, Promise<string[]>>] {
        if (!wizardContext._allLocationsTask) {
            wizardContext._allLocationsTask = getAllLocations(wizardContext);
        }

        if (!wizardContext._providerLocationsMap) {
            wizardContext._providerLocationsMap = new Map<string, Promise<string[]>>();
            // Should be relevant for all our wizards
            this.addProviderForFiltering(wizardContext, resourcesProvider, 'resourceGroups');
        }
        return [wizardContext._allLocationsTask, wizardContext._providerLocationsMap];
    }

    public static async setLocation<T extends ILocationWizardContextInternal>(wizardContext: T, name: string): Promise<void> {
        const [allLocationsTask] = this.getInternalVariables(wizardContext);
        wizardContext._location = (await allLocationsTask).find(l => matchesLocation(l, name));
    }

    public static setLocationSubset<T extends ILocationWizardContextInternal>(wizardContext: T, task: Promise<string[]>, provider: string): void {
        const [, providerLocationsMap] = this.getInternalVariables(wizardContext);
        providerLocationsMap.set(provider.toLowerCase(), task);
    }

    public static addProviderForFiltering<T extends ILocationWizardContextInternal>(wizardContext: T, provider: string, resourceType: string): void {
        this.setLocationSubset(wizardContext, getProviderLocations(wizardContext, provider, resourceType), provider);
    }

    public static hasLocation<T extends ILocationWizardContextInternal>(wizardContext: T): boolean {
        return !!wizardContext._location;
    }

    public static async getLocation<T extends ILocationWizardContextInternal>(wizardContext: T, provider?: string): Promise<types.AzExtLocation> {
        const location = nonNullProp(wizardContext, '_location');
        if (provider) {
            const [allLocationsTask, providerLocationsMap] = this.getInternalVariables(wizardContext);
            const providerLocations = await providerLocationsMap.get(provider.toLowerCase());
            if (providerLocations) {
                function isSupportedByProvider(loc: types.AzExtLocation): boolean {
                    return !!providerLocations?.find(name => matchesLocation(loc, name));
                }
                function useProviderName(loc: types.AzExtLocation): types.AzExtLocation {
                    // Some providers prefer their version of the name over the standard one, so we'll create a shallow clone using theirs
                    return { ...loc, name: nonNullValue(providerLocations?.find(name => matchesLocation(loc, name), 'providerName')) };
                }
                function warnAboutRelatedLocation(loc: types.AzExtLocation): void {
                    ext.outputChannel.appendLog(localize('relatedLocWarning', 'WARNING: Provider "{0}" does not support location "{1}". Using "{2}" instead.', provider, location.displayName, loc.displayName));
                }

                if (isSupportedByProvider(location)) {
                    return useProviderName(location);
                }

                const allLocations = await allLocationsTask;
                if (location.metadata?.pairedRegion) {
                    const pairedLocation: types.AzExtLocation | undefined = location.metadata?.pairedRegion
                        .map(paired => allLocations.find(l => paired.name && matchesLocation(l, paired.name)))
                        .find(pairedLoc => pairedLoc && isSupportedByProvider(pairedLoc));
                    if (pairedLocation) {
                        wizardContext.telemetry.properties.relatedLocationSource = 'paired';
                        warnAboutRelatedLocation(pairedLocation);
                        return useProviderName(pairedLocation);
                    }
                }

                if (location.name.toLowerCase().endsWith('stage')) {
                    const nonStageName = location.name.replace(/stage/i, '');
                    const nonStageLocation = allLocations.find(l => matchesLocation(l, nonStageName));
                    if (nonStageLocation && isSupportedByProvider(nonStageLocation)) {
                        wizardContext.telemetry.properties.relatedLocationSource = 'nonStage';
                        warnAboutRelatedLocation(nonStageLocation);
                        return useProviderName(nonStageLocation);
                    }
                }

                // Fall through to use the selected location just in case our "supported" list is wrong and since Azure should give them an error anyways
                wizardContext.telemetry.properties.locationProviderNotFound = provider;
            }
        }

        return location;
    }

    public static async getLocations<T extends ILocationWizardContextInternal>(wizardContext: T): Promise<types.AzExtLocation[]> {
        const [allLocationsTask, providerLocationsMap] = this.getInternalVariables(wizardContext);
        const locationSubsets: string[][] = await Promise.all(providerLocationsMap.values());
        // Filter to locations supported by every provider
        return (await allLocationsTask).filter(l1 => locationSubsets.every(subset =>
            subset.find(l2 => generalizeLocationName(l1.name) === generalizeLocationName(l2))
        ));
    }

    public async prompt(wizardContext: T): Promise<void> {
        const options: types.IAzureQuickPickOptions = { placeHolder: localize('selectLocation', 'Select a location for new resources.'), enableGrouping: true };
        wizardContext._location = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext._location;
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

function generalizeLocationName(name: string | undefined): string {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
}

function matchesLocation(loc: types.AzExtLocation, name: string): boolean {
    name = generalizeLocationName(name);
    return name === generalizeLocationName(loc.name) || name === generalizeLocationName(loc.displayName);
}

async function getAllLocations(wizardContext: types.ISubscriptionContext): Promise<types.AzExtLocation[]> {
    // NOTE: Using a generic client because the subscriptions sdk is pretty far behind on api-version
    const client = await createGenericClient(wizardContext);
    const response = await client.sendRequest({
        method: 'GET',
        url: `/subscriptions/${wizardContext.subscriptionId}/locations?api-version=2019-11-01`
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return <types.AzExtLocation[]>response.parsedBody.value;
}

async function getProviderLocations(wizardContext: types.ISubscriptionContext, provider: string, resourceType: string): Promise<string[]> {
    const rgClient = await createResourcesClient(wizardContext);
    const providerData = await rgClient.providers.get(provider);
    const resourceTypeData = providerData.resourceTypes?.find(rt => rt.resourceType?.toLowerCase() === resourceType.toLowerCase());
    return nonNullProp(nonNullValue(resourceTypeData, 'resourceTypeData'), 'locations');
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
