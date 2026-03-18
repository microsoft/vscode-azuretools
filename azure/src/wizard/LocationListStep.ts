/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ExtendedLocation, Provider } from '@azure/arm-resources';
import type { Location } from '@azure/arm-resources-subscriptions';
import { AgentQuickPickItem, AgentQuickPickOptions, AzureWizardPromptStep, IActionContext, IAzureAgentInput, IAzureQuickPickItem, IAzureQuickPickOptions, nonNullProp, nonNullValue } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ILocationWizardContext } from './resourceGroupWizardTypes';
import { createResourcesClient, createSubscriptionsClient } from '../clients';
import { resourcesProvider } from '../constants';
import { ext } from '../extensionVariables';
import { uiUtils } from '../utils/uiUtils';

export type AzExtLocation = Location & {
    id: string;
    name: string;
    displayName: string;
}

/* eslint-disable @typescript-eslint/naming-convention */
interface ILocationWizardContextInternal extends ILocationWizardContext {
    /**
     * The task used to get locations.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    _allLocationsTask?: Promise<AzExtLocation[]>;

    _alreadyHasLocationStep?: boolean;

    /**
     * Map of the provider (i.e. 'Microsoft.Web') to it's supported locations
     */
    _providerLocationsMap?: Map<string, Promise<string[]>>;

    /**
     * The selected location. There's a small chance it's not supported by all providers if `setLocation` was used
     */
    _location?: AzExtLocation;

    /**
     * The location to auto-select during prompting, if available.
     * Leverage this rather than `setLocation` when you want to automatically select a location
     * that respects all future resource providers.
     */
    _autoSelectLocation?: AzExtLocation;

    /**
     * Location list step is intended to be compatible with an {@link IAzureAgentInput}, so we re-type `ui`.
     */
    ui: IAzureAgentInput;
}
/* eslint-enable @typescript-eslint/naming-convention */

export class LocationListStep<T extends ILocationWizardContext> extends AzureWizardPromptStep<T> {
    protected constructor(private options?: IAzureQuickPickOptions) {
        super();
    }

    /**
     * Adds a LocationListStep to the wizard.  This function will ensure there is only one LocationListStep per wizard context.
     * @param wizardContext The context of the wizard
     * @param promptSteps The array of steps to include the LocationListStep to
     * @param options Options to pass to ui.showQuickPick. Options are spread onto the defaults.
     */
    public static addStep<T extends ILocationWizardContext>(wizardContext: IActionContext & Partial<ILocationWizardContext>, promptSteps: AzureWizardPromptStep<T>[], options?: IAzureQuickPickOptions): void {
        const ctx = wizardContext as IActionContext & Partial<ILocationWizardContextInternal>;
        if (!ctx._alreadyHasLocationStep) {
            promptSteps.push(new this(options));
            ctx._alreadyHasLocationStep = true;
        }
    }

    private static getInternalVariables(wizardContext: ILocationWizardContext): [Promise<AzExtLocation[]>, Map<string, Promise<string[]>>] {
        const ctx = wizardContext as ILocationWizardContextInternal;
        ctx._allLocationsTask ??= getAllLocations(wizardContext);

        if (!ctx._providerLocationsMap) {
            ctx._providerLocationsMap = new Map<string, Promise<string[]>>();
            // Should be relevant for all our wizards
            this.addProviderForFiltering(wizardContext, resourcesProvider, 'resourceGroups');
        }
        return [ctx._allLocationsTask, ctx._providerLocationsMap];
    }

    /**
     * This will set the wizard context's location (in which case the user will _not_ be prompted for location)
     * For example, if the user selects an existing resource, you might want to use that location as the default for the wizard's other resources
     * This _will_ set the location even if not all providers support it - in the hopes that a related location can be found during `getLocation`
     * @param wizardContext The context of the wizard
     * @param name The name or display name of the location
     */
    public static async setLocation<T extends ILocationWizardContext>(wizardContext: T, name: string): Promise<void> {
        const ctx = wizardContext as T & ILocationWizardContextInternal;
        const [allLocationsTask] = this.getInternalVariables(wizardContext);
        ctx._location = (await allLocationsTask).find(l => LocationListStep.locationMatchesName(l, name));
        wizardContext.telemetry.properties.locationType = ctx._location?.type;
    }

    /**
     * Specify a task that will be used to filter locations
     * @param wizardContext The context of the wizard
     * @param task A task evaluating to the locations supported by this provider
     * @param provider The relevant provider (i.e. 'Microsoft.Web')
     */
    public static setLocationSubset<T extends ILocationWizardContext>(wizardContext: T, task: Promise<string[]>, provider: string): void {
        const [, providerLocationsMap] = this.getInternalVariables(wizardContext);
        providerLocationsMap.set(provider.toLowerCase(), task);
    }

    /**
     * Sets a location to auto-select during prompting, if available.
     * Use this instead of `setLocation` when you want to automatically select a location
     * that respects all future resource providers.
     * @param wizardContext The context of the wizard
     * @param name The name or display name of the suggested location
     */
    public static async setAutoSelectLocation<T extends ILocationWizardContext>(wizardContext: T, name: string): Promise<void> {
        const ctx = wizardContext as T & ILocationWizardContextInternal;
        const [allLocationsTask] = this.getInternalVariables(wizardContext);
        ctx._autoSelectLocation = (await allLocationsTask).find(l => LocationListStep.locationMatchesName(l, name));
        wizardContext.telemetry.properties.autoSelectLocationType = ctx._autoSelectLocation?.type;
    }

    /**
     * Resets all location and location-related metadata on the wizard context back to its uninitialized state.
     * This includes clearing the selected location, cached location tasks, provider location maps, and any step-tracking flags.
     * Use this to ensure the wizard context is fully reset before starting a new location selection process.
     * @param wizardContext The context of the wizard
     */
    public static resetLocation<T extends ILocationWizardContext>(wizardContext: T): void {
        const ctx = wizardContext as T & ILocationWizardContextInternal;
        ctx._location = undefined;
        ctx._allLocationsTask = undefined;
        ctx._providerLocationsMap = undefined;
        ctx._alreadyHasLocationStep = undefined;
        ctx._autoSelectLocation = undefined;
    }

    /**
     * Adds default location filtering for a provider
     * If more granular filtering is needed, use `setLocationSubset` instead (i.e. if the provider further filters locations based on features)
     * @param wizardContext The context of the wizard
     * @param provider The provider (i.e. 'Microsoft.Storage')
     * @param resourceType The resource type (i.e. 'storageAccounts')
     */
    public static addProviderForFiltering<T extends ILocationWizardContext>(wizardContext: T, provider: string, resourceType: string): void {
        this.setLocationSubset(wizardContext, getProviderLocations(wizardContext, provider, resourceType), provider);
    }

    /**
     * Returns true if a location has been set on the context
     */
    public static hasLocation<T extends ILocationWizardContext>(wizardContext: T): boolean {
        return !!(wizardContext as T & ILocationWizardContextInternal)._location;
    }

    /**
     * Used to convert a location into a home location and an extended location if the location passed in is an extended location.
     * If the location passed in is not extended, then extendedLocation will be `undefined`.
     * @param location location or extended location
     */
    public static getExtendedLocation(location: AzExtLocation): { location: string, extendedLocation?: ExtendedLocation } {
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
        };
    }

    /**
     * Gets the `autoSelectLocation` for this wizard.  This location will be automatically selected during prompting, if available.
     * @param wizardContext The context of the wizard
     */
    public static getAutoSelectLocation<T extends ILocationWizardContext>(wizardContext: T): AzExtLocation | undefined {
        return (wizardContext as T & ILocationWizardContextInternal)._autoSelectLocation;
    }

    /**
     * Gets the selected location for this wizard.
     * @param wizardContext The context of the wizard
     * @param provider If specified, this will check against that provider's supported locations and attempt to find a "related" location if the selected location is not supported.
     * @param supportsExtendedLocations If set to true, the location returned may be an extended location, in which case the `extendedLocation` property should be added when creating a resource
     */
    public static async getLocation<T extends ILocationWizardContext>(wizardContext: T, provider?: string, supportsExtendedLocations?: boolean): Promise<AzExtLocation> {
        const ctx = wizardContext as T & ILocationWizardContextInternal;
        let location: AzExtLocation = nonNullProp(ctx, '_location');

        function warnAboutRelatedLocation(loc: AzExtLocation): void {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
                function isSupportedByProvider(loc: AzExtLocation): boolean {
                    return !!providerLocations?.find(name => LocationListStep.locationMatchesName(loc, name));
                }
                function useProviderName(loc: AzExtLocation): AzExtLocation {
                    // Some providers prefer their version of the name over the standard one, so we'll create a shallow clone using theirs
                    return { ...loc, name: nonNullValue(providerLocations?.find(name => LocationListStep.locationMatchesName(loc, name), 'providerName')) };
                }

                if (isSupportedByProvider(location)) {
                    return useProviderName(location);
                }

                const allLocations = await allLocationsTask;
                if (location.metadata?.pairedRegion) {
                    const pairedLocation: AzExtLocation | undefined = location.metadata?.pairedRegion
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

    /**
     * Used to get locations. By passing in the context, we can ensure that Azure is only queried once for the entire wizard
     * @param wizardContext The context of the wizard.
     */
    public static async getLocations<T extends ILocationWizardContext>(wizardContext: T): Promise<AzExtLocation[]> {
        const [allLocationsTask, providerLocationsMap] = this.getInternalVariables(wizardContext);
        const locationSubsets: string[][] = await Promise.all(providerLocationsMap.values());
        // Filter to locations supported by every provider
        return (await allLocationsTask).filter(l1 => (l1.type === 'EdgeZone' && wizardContext.includeExtendedLocations) || locationSubsets.every(subset =>
            subset.find(l2 => LocationListStep.generalizeLocationName(l1.name) === LocationListStep.generalizeLocationName(l2))
        ));
    }

    /**
     * Returns true if the given location matches the name
     */
    public static locationMatchesName(location: AzExtLocation, name: string): boolean {
        name = LocationListStep.generalizeLocationName(name);
        return name === LocationListStep.generalizeLocationName(location.name) || name === LocationListStep.generalizeLocationName(location.displayName);
    }

    public async prompt(wizardContext: T): Promise<void> {
        const options: AgentQuickPickOptions = {
            placeHolder: vscode.l10n.t('Select a location for new resources.'),
            enableGrouping: true,
            agentMetadata: {
                parameterDisplayTitle: vscode.l10n.t('Location'),
                parameterDisplayDescription: vscode.l10n.t('The location where resources will be deployed.')
            },
            ...this.options
        };

        const picks = await this.getQuickPicks(wizardContext);

        let pick: AgentQuickPickItem<IAzureQuickPickItem<AzExtLocation>> | undefined;
        const ctx = wizardContext as T & ILocationWizardContextInternal;
        if (ctx._autoSelectLocation) {
            pick = picks.find(p => p.data.id === ctx._autoSelectLocation?.id);
        }
        pick ??= await (wizardContext as T & { ui: IAzureAgentInput }).ui.showQuickPick(picks, options);

        ctx._location = pick.data;
        wizardContext.telemetry.properties.locationType = ctx._location.type;
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !(wizardContext as T & ILocationWizardContextInternal)._location;
    }

    protected async getQuickPicks(wizardContext: T): Promise<AgentQuickPickItem<IAzureQuickPickItem<AzExtLocation>>[]> {
        let locations: AzExtLocation[] = await LocationListStep.getLocations(wizardContext);
        locations = locations.sort(compareLocation);

        return locations.map(l => {
            return {
                label: nonNullProp(l, 'displayName'),
                group: l.metadata?.regionCategory,
                data: l,
                description: LocationListStep.getQuickPickDescription?.(l),
                agentMetadata: {}
            };
        });
    }

    public static generalizeLocationName(name: string | undefined): string {
        return (name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
    }

    /**
     * Implement this to set descriptions on location quick pick items.
     */
    public static getQuickPickDescription?: (location: AzExtLocation) => string | undefined;
}

async function getAllLocations(wizardContext: ILocationWizardContext): Promise<AzExtLocation[]> {
    const client = await createSubscriptionsClient(wizardContext);
    const locations = await uiUtils.listAllIterator<Location>(client.subscriptions.listLocations(wizardContext.subscriptionId, { includeExtendedLocations: wizardContext.includeExtendedLocations }));
    return locations.filter((l): l is AzExtLocation => !!(l.id && l.name && l.displayName));
}

async function getProviderLocations(wizardContext: ILocationWizardContext, provider: string, resourceType: string): Promise<string[]> {
    const rgClient = await createResourcesClient(wizardContext);
    const providerData = await rgClient.providers.get(provider);
    const resourceTypeData = providerData.resourceTypes?.find(rt => rt.resourceType?.toLowerCase() === resourceType.toLowerCase());
    if (!resourceTypeData) {
        throw new ProviderResourceTypeNotFoundError(providerData, resourceType);
    }
    return nonNullProp(resourceTypeData, 'locations');
}

function compareLocation(l1: AzExtLocation, l2: AzExtLocation): number {
    if (!isRecommended(l1) && isRecommended(l2)) {
        return 1;
    } else if (isRecommended(l1) && !isRecommended(l2)) {
        return -1;
    } else {
        return 0; // use the default order returned by the API
    }
}

function isRecommended(l: AzExtLocation): boolean {
    return l.metadata?.regionCategory?.toLowerCase() === 'recommended';
}

class ProviderResourceTypeNotFoundError extends Error {
    constructor(provider: Provider, expectedResourceType: string) {
        super(vscode.l10n.t('Provider "{0}" does not have resource type "{1}".', provider.id || 'undefined', expectedResourceType));
    }
}
