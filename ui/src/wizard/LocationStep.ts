/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient } from 'azure-arm-resource';
import { Location } from 'azure-arm-resource/lib/subscription/models';
import { QuickPickOptions } from 'vscode';
import { IAzureQuickPickItem, IAzureUserInput, ILocationWizardContext } from '../../index';
import { localize } from '../localize';
import { AzureWizardStep } from './AzureWizardStep';

export class LocationStep<T extends ILocationWizardContext> extends AzureWizardStep<T> {
    public async prompt(wizardContext: T, ui: IAzureUserInput): Promise<T> {
        const client: SubscriptionClient = new SubscriptionClient(wizardContext.credentials);
        // tslint:disable-next-line:no-non-null-assertion
        const locationsTask: Promise<Location[]> = client.subscriptions.listLocations(wizardContext.subscription.subscriptionId!);

        if (wizardContext.defaultLocationName) {
            wizardContext.location = (await locationsTask).find((l: Location) => wizardContext.defaultLocationName === l.name || wizardContext.defaultLocationName === l.displayName);
        }

        if (!wizardContext.location) {
            const options: QuickPickOptions = { placeHolder: localize('selectLocation', 'Select a location for new resources.') };
            wizardContext.location = (await ui.showQuickPick(this.getQuickPicks(locationsTask), options)).data;
        }

        return wizardContext;
    }

    public async execute(wizardContext: T): Promise<T> {
        return wizardContext;
    }

    private async getQuickPicks(locationsTask: Promise<Location[]>): Promise<IAzureQuickPickItem<Location>[]> {
        return (await locationsTask).map((l: Location) => {
            return {
                // tslint:disable-next-line:no-non-null-assertion
                label: l.displayName!,
                description: '',
                data: l
            };
        });
    }
}
