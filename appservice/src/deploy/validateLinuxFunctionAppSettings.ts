/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { IActionContext } from 'vscode-azureextensionui';
import { SiteClient } from '../SiteClient';

export async function validateLinuxFunctionAppSettings(context: IActionContext, client: SiteClient, doBuild: boolean, isConsumption: boolean): Promise<void> {
    const appSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
    // tslint:disable-next-line:strict-boolean-expressions
    appSettings.properties = appSettings.properties || {};

    let hasChanged: boolean = false;

    const keysToRemove: string[] = [];

    if (doBuild) {
        keysToRemove.push(
            'WEBSITE_RUN_FROM_ZIP',
            'WEBSITE_RUN_FROM_PACKAGE'
        );
    }

    if (!isConsumption) {
        const dedicatedBuildSettings: [string, string][] = [
            ['ENABLE_ORYX_BUILD', 'true'],
            ['SCM_DO_BUILD_DURING_DEPLOYMENT', '1'],
            ['BUILD_FLAGS', 'UseExpressBuild'],
            ['XDG_CACHE_HOME', '/tmp/.cache']
        ];

        for (const [key, value] of dedicatedBuildSettings) {
            if (!doBuild) {
                keysToRemove.push(key);
            } else if (appSettings.properties[key] !== value) {
                appSettings.properties[key] = value;
                hasChanged = true;
            }
        }
    }

    for (const key of keysToRemove) {
        if (appSettings.properties[key]) {
            delete appSettings.properties[key];
            hasChanged = true;
        }
    }

    if (hasChanged) {
        context.telemetry.properties.updatedAppSettings = 'true';
        await client.updateApplicationSettings(appSettings);
    }
}
