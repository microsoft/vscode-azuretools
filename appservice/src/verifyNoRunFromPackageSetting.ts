/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "@azure/arm-appservice";
import { IAppSettingsClient } from './appSettings/IAppSettingsClient';
import { ext } from "./extensionVariables";
import { localize } from "./localize";

// prior to git deploying, these settings must be deleted or it will fail
export async function verifyNoRunFromPackageSetting(client: IAppSettingsClient): Promise<void> {
    let updateSettings: boolean = false;
    const runFromPackageSettings: string[] = ['WEBSITE_RUN_FROM_PACKAGE', 'WEBSITE_RUN_FROM_ZIP'];
    const applicationSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
    for (const settingName of runFromPackageSettings) {
        if (applicationSettings.properties && applicationSettings.properties[settingName]) {
            delete applicationSettings.properties[settingName];
            ext.outputChannel.appendLog(localize('deletingSetting', 'Deleting setting "{0}"...', settingName), { resourceName: client.fullName });
            updateSettings = true;
        }
    }
    if (updateSettings) {
        await client.updateApplicationSettings(applicationSettings);
    }
}
