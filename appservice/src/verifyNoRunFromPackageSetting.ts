/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from "azure-arm-website/lib/models";
import { formatDeployLog } from "./deploy/formatDeployLog";
import { ext } from "./extensionVariables";
import { localize } from "./localize";
import { SiteClient } from "./SiteClient";

// prior to git deploying, these settings must be deleted or it will fail
export async function verifyNoRunFromPackageSetting(client: SiteClient): Promise<void> {
    let updateSettings: boolean = false;
    const runFromPackageSettings: string[] = ['WEBSITE_RUN_FROM_PACKAGE', 'WEBSITE_RUN_FROM_ZIP'];
    const applicationSettings: StringDictionary = await client.listApplicationSettings();
    for (const settingName of runFromPackageSettings) {
        if (applicationSettings.properties && applicationSettings.properties[settingName]) {
            delete applicationSettings.properties[settingName];
            ext.outputChannel.appendLine(formatDeployLog(client, localize('deletingSetting', 'Deleting setting "{0}"...', settingName)));
            updateSettings = true;
        }
    }
    if (updateSettings) {
        await client.updateApplicationSettings(applicationSettings);
    }
}
