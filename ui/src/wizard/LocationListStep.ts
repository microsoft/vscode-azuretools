/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient } from '@azure/arm-subscriptions';
import { Location } from '@azure/arm-subscriptions/lib/models';
import { QuickPickOptions } from 'vscode';
import * as types from '../../index';
import { createAzureSubscriptionClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';

function generalizeLocationName(name: string | undefined): string {
    // tslint:disable-next-line:strict-boolean-expressions
    return (name || '').toLowerCase().replace(/\s/g, '');
}

export class LocationListStep<T extends types.ILocationWizardContext> extends AzureWizardPromptStep<T> implements types.LocationListStep<T> {
    public static async setLocation<T extends types.ILocationWizardContext>(wizardContext: T, name: string): Promise<void> {
        const locations: Location[] = await LocationListStep.getLocations(wizardContext);
        name = generalizeLocationName(name);
        wizardContext.location = locations.find((l: Location) => {
            return name === generalizeLocationName(l.name) || name === generalizeLocationName(l.displayName);
        });
    }

    public static async getLocations<T extends types.ILocationWizardContext>(wizardContext: T): Promise<Location[]> {
        if (wizardContext.locationsTask === undefined) {
            const client: SubscriptionClient = createAzureSubscriptionClient(wizardContext, SubscriptionClient);
            wizardContext.locationsTask = client.subscriptions.listLocations(wizardContext.subscriptionId);
        }

        return await wizardContext.locationsTask;
    }

    public async prompt(wizardContext: T): Promise<void> {
        const options: QuickPickOptions = { placeHolder: localize('selectLocation', 'Select a location for new resources.') };
        wizardContext.location = (await ext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.location;
    }

    private async getQuickPicks(wizardContext: T): Promise<types.IAzureQuickPickItem<Location>[]> {
        let locations: Location[] = await LocationListStep.getLocations(wizardContext);
        // tslint:disable-next-line:no-non-null-assertion
        locations = locations.sort((l1: Location, l2: Location) => l1.displayName!.localeCompare(l2.displayName!));
        return locations.map((l: Location) => {
            return {
                // tslint:disable-next-line:no-non-null-assertion
                label: l.displayName!,
                description: '',
                data: l
            };
        });
    }
}
