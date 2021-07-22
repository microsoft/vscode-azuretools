/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "@azure/arm-appservice";
import { IActionContext } from "vscode-azureextensionui";
import { ext } from "./extensionVariables";
import { localize } from "./localize";
import { ParsedSite } from "./SiteClient";

// prior to git deploying, these settings must be deleted or it will fail
export async function verifyNoRunFromPackageSetting(context: IActionContext, site: ParsedSite): Promise<void> {
    let updateSettings: boolean = false;
    const runFromPackageSettings: string[] = ['WEBSITE_RUN_FROM_PACKAGE', 'WEBSITE_RUN_FROM_ZIP'];
    const client = await site.createClient(context);
    const applicationSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
    for (const settingName of runFromPackageSettings) {
        if (applicationSettings.properties && applicationSettings.properties[settingName]) {
            delete applicationSettings.properties[settingName];
            ext.outputChannel.appendLog(localize('deletingSetting', 'Deleting setting "{0}"...', settingName), { resourceName: site.fullName });
            updateSettings = true;
        }
    }
    if (updateSettings) {
        await client.updateApplicationSettings(applicationSettings);
    }
}
