/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ExtendedLocation } from '@azure/arm-resources';
import type { Location } from '@azure/arm-resources-subscriptions';
import { AzureWizardPromptStep, IActionContext, IAzureQuickPickItem, IAzureQuickPickOptions, nonNullProp, nonNullValue } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as types from '../../index';
import { createResourcesClient, createSubscriptionsClient } from '../clients';
import { resourcesProvider } from '../constants';
import { ext } from '../extensionVariables';
import { uiUtils } from '../utils/uiUtils';

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
    protected constructor(private options?: IAzureQuickPickOptions) {
        super();
    }

    public static addStep<T extends ILocationWizardContextInternal>(wizardContext: IActionContext & Partial<ILocationWizardContextInternal>, promptSteps: AzureWizardPromptStep<T>[], options?: IAzureQuickPickOptions): void {
        if (!wizardContext._alreadyHasLocationStep) {
            promptSteps.push(new this(options));
            wizardContext._alreadyHasLocationStep = true;
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
        wizardContext._location = (await allLocationsTask).find(l => LocationListStep.locationMatchesName(l, name));
        wizardContext.telemetry.properties.locationType = wizardContext._location?.type;
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

    public static getExtendedLocation(location: types.AzExtLocation): { location: string, extendedLocation?: ExtendedLocation } {
        let locationName: string = location.name;
        let extendedLocation: ExtendedLocation | undefined;
        if (location.type === 'EdgeZone') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            locationName = location.metadata!.homeLocation!;
            extendedLocation = <ExtendedLocation>location;
        }
        return {
            location: locationName,
            extendedLocation
        }
    }

    public static async getLocation<T extends ILocationWizardContextInternal>(wizardContext: T, provider?: string, supportsExtendedLocations?: boolean): Promise<types.AzExtLocation> {
        let location: types.AzExtLocation = nonNullProp(wizardContext, '_location');

        function warnAboutRelatedLocation(loc: types.AzExtLocation): void {
            ext.outputChannel.appendLog(vscode.l10n.t('WARNING: Provider "{0}" does not support location "{1}". Using "{2}" instead.', provider!, location.displayName, loc.displayName));
        }

        if (location.type === 'EdgeZone') {
            if (supportsExtendedLocations) {
                // The `providerLocations` list doesn't seem to include EdgeZones, so there's no point in falling through to provider checks below
                return location;
            } else {
                const homeLocName = nonNullProp(nonNullProp(location, 'metadata'), 'homeLocation');
                const [allLocationsTask,] = this.getInternalVariables(wizardContext);
                const allLocations = await allLocationsTask;
                const homeLocation = nonNullValue(allLocations.find(l => LocationListStep.locationMatchesName(l, homeLocName)), 'homeLocation');
                wizardContext.telemetry.properties.relatedLocationSource = 'home';
                ext.outputChannel.appendLog(vscode.l10n.t('WARNING: Resource does not support extended location "{0}". Using "{1}" instead.', location.displayName, homeLocation.displayName));
                location = homeLocation;
            }
        }

        if (provider) {
            const [allLocationsTask, providerLocationsMap] = this.getInternalVariables(wizardContext);
            const providerLocations = await providerLocationsMap.get(provider.toLowerCase());
            if (providerLocations) {
                function isSupportedByProvider(loc: types.AzExtLocation): boolean {
                    return !!providerLocations?.find(name => LocationListStep.locationMatchesName(loc, name));
                }
                function useProviderName(loc: types.AzExtLocation): types.AzExtLocation {
                    // Some providers prefer their version of the name over the standard one, so we'll create a shallow clone using theirs
                    return { ...loc, name: nonNullValue(providerLocations?.find(name => LocationListStep.locationMatchesName(loc, name), 'providerName')) };
                }

                if (isSupportedByProvider(location)) {
                    return useProviderName(location);
                }

                const allLocations = await allLocationsTask;
                if (location.metadata?.pairedRegion) {
                    const pairedLocation: types.AzExtLocation | undefined = location.metadata?.pairedRegion
                        .map(paired => allLocations.find(l => paired.name && LocationListStep.locationMatchesName(l, paired.name)))
                        .find(pairedLoc => pairedLoc && isSupportedByProvider(pairedLoc));
                    if (pairedLocation) {
                        wizardContext.telemetry.properties.relatedLocationSource = 'paired';
                        warnAboutRelatedLocation(pairedLocation);
                        return useProviderName(pairedLocation);
                    }
                }

                if (location.name.toLowerCase().endsWith('stage')) {
                    const nonStageName = location.name.replace(/stage/i, '');
                    const nonStageLocation = allLocations.find(l => LocationListStep.locationMatchesName(l, nonStageName));
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
        return (await allLocationsTask).filter(l1 => (l1.type === 'EdgeZone' && wizardContext.includeExtendedLocations) || locationSubsets.every(subset =>
            subset.find(l2 => generalizeLocationName(l1.name) === generalizeLocationName(l2))
        ));
    }

    public static locationMatchesName(location: types.AzExtLocation, name: string): boolean {
        name = generalizeLocationName(name);
        return name === generalizeLocationName(location.name) || name === generalizeLocationName(location.displayName);
    }

    public async prompt(wizardContext: T): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: vscode.l10n.t('Select a location for new resources.'), enableGrouping: true, ...this.options };
        wizardContext._location = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
        wizardContext.telemetry.properties.locationType = wizardContext._location.type;
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext._location;
    }

    protected async getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<types.AzExtLocation>[]> {
        let locations: types.AzExtLocation[] = await LocationListStep.getLocations(wizardContext);
        locations = locations.sort(compareLocation);

        return locations.map(l => {
            return {
                label: nonNullProp(l, 'displayName'),
                group: l.metadata?.regionCategory,
                data: l,
                description: LocationListStep.getQuickPickDescription?.(l)
            };
        });
    }

    public static getQuickPickDescription?: (location: types.AzExtLocation) => string | undefined;
}

function generalizeLocationName(name: string | undefined): string {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
}

async function getAllLocations(wizardContext: types.ILocationWizardContext): Promise<types.AzExtLocation[]> {
    const client = await createSubscriptionsClient(wizardContext);
    const locations = await uiUtils.listAllIterator<Location>(client.subscriptions.listLocations(wizardContext.subscriptionId, { includeExtendedLocations: wizardContext.includeExtendedLocations }));
    return locations.filter((l): l is types.AzExtLocation => !!(l.id && l.name && l.displayName));
}

async function getProviderLocations(wizardContext: types.ILocationWizardContext, provider: string, resourceType: string): Promise<string[]> {
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
