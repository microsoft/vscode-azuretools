/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient } from 'azure-arm-resource';
import { Location } from 'azure-arm-resource/lib/subscription/models';
import { QuickPickOptions } from 'vscode';
import { IAzureQuickPickItem, ILocationWizardContext } from '../../index';
import { createAzureSubscriptionClient } from '../createAzureClient';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';

export class LocationListStep<T extends ILocationWizardContext> extends AzureWizardPromptStep<T> {
    public static async setLocation<T extends ILocationWizardContext>(wizardContext: T, name: string): Promise<void> {
        const locations: Location[] = await LocationListStep.getLocations(wizardContext);
        wizardContext.location = locations.find((l: Location) => name === l.name || name === l.displayName);
    }

    public static async getLocations<T extends ILocationWizardContext>(wizardContext: T): Promise<Location[]> {
        if (wizardContext.locationsTask === undefined) {
            const client: SubscriptionClient = createAzureSubscriptionClient(wizardContext, SubscriptionClient);
            wizardContext.locationsTask = client.subscriptions.listLocations(wizardContext.subscriptionId);
        }

        return await wizardContext.locationsTask;
    }

    public async prompt(wizardContext: T): Promise<T> {
        if (!wizardContext.location) {
            const options: QuickPickOptions = { placeHolder: localize('selectLocation', 'Select a location for new resources.') };
            wizardContext.location = (await ext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
        }

        return wizardContext;
    }

    private async getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<Location>[]> {
        const locations: Location[] = await LocationListStep.getLocations(wizardContext);
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
