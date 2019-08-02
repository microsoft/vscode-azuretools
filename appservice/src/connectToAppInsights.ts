/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationInsightsComponent } from "azure-arm-appinsights/lib/models";
import { StringDictionary } from "azure-arm-website/lib/models";
import { SiteClient } from "./SiteClient";

export async function connectToAppInsights(client: SiteClient, appInsightComponent: ApplicationInsightsComponent): Promise<void> {

    const appSettings: StringDictionary = await client.listApplicationSettings();
    // tslint:disable-next-line:strict-boolean-expressions
    appSettings.properties = appSettings.properties || {};

    const appInsightKey: string = 'APPINSIGHTS_INSTRUMENTATIONKEY';
    if (appInsightComponent.instrumentationKey) {
        appSettings.properties[appInsightKey] = appInsightComponent.instrumentationKey;
        await client.updateApplicationSettings(appSettings);
    }
}
