/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient, SubscriptionModels } from '@azure/arm-subscriptions';
import { QuickPickOptions } from 'vscode';
import * as types from '../../index';
import { createSubscriptionsClient } from '../clients';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';

function generalizeLocationName(name: string | undefined): string {
    return (name || '').toLowerCase().replace(/\s/g, '');
}

interface ILocationWizardContextInternal extends types.ILocationWizardContext {
    /**
     * The task used to get locations.
     * By specifying this in the context, we can ensure that Azure is only queried once for the entire wizard
     */
    _allLocationsTask?: Promise<SubscriptionModels.Location[]>;

    _alreadyHasLocationStep?: boolean;
}

export class LocationListStep<T extends ILocationWizardContextInternal> extends AzureWizardPromptStep<T> implements types.LocationListStep<T> {

    private constructor() {
        super();
    }

    public static addStep<T extends ILocationWizardContextInternal>(wizardContext: types.IActionContext & Partial<ILocationWizardContextInternal>, promptSteps: AzureWizardPromptStep<T>[]): void {
        if (!wizardContext._alreadyHasLocationStep) {
            promptSteps.push(new LocationListStep());
            wizardContext._alreadyHasLocationStep = true;
        }
    }

    public static async setLocation<T extends ILocationWizardContextInternal>(wizardContext: T, name: string): Promise<void> {
        const locations: SubscriptionModels.Location[] = await LocationListStep.getLocations(wizardContext);
        name = generalizeLocationName(name);
        wizardContext.location = locations.find(l => {
            return name === generalizeLocationName(l.name) || name === generalizeLocationName(l.displayName);
        });
    }

    public static async getLocations<T extends ILocationWizardContextInternal>(wizardContext: T): Promise<SubscriptionModels.Location[]> {
        if (wizardContext._allLocationsTask === undefined) {
            const client: SubscriptionClient = await createSubscriptionsClient(wizardContext);
            wizardContext._allLocationsTask = client.subscriptions.listLocations(wizardContext.subscriptionId);
        }

        const allLocations: SubscriptionModels.Location[] = await wizardContext._allLocationsTask;
        if (wizardContext.locationsTask === undefined) {
            return allLocations;
        } else {
            const locationsSubset: { name?: string }[] = await wizardContext.locationsTask;
            return allLocations.filter(l1 => locationsSubset.find(l2 => generalizeLocationName(l1.name) === generalizeLocationName(l2.name)));
        }
    }

    public async prompt(wizardContext: T): Promise<void> {
        const options: QuickPickOptions = { placeHolder: localize('selectLocation', 'Select a location for new resources.') };
        wizardContext.location = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.location;
    }

    private async getQuickPicks(wizardContext: T): Promise<types.IAzureQuickPickItem<SubscriptionModels.Location>[]> {
        let locations: SubscriptionModels.Location[] = await LocationListStep.getLocations(wizardContext);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        locations = locations.sort((l1, l2) => l1.displayName!.localeCompare(l2.displayName!));
        return locations.map(l => {
            return {
                label: nonNullProp(l, 'displayName'),
                description: '',
                data: l
            };
        });
    }
}
