/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { StringDictionary } from "@azure/arm-appservice";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { ext } from "./extensionVariables";
import { ParsedSite } from "./SiteClient";

// prior to git deploying, these settings must be deleted or it will fail
export async function verifyNoRunFromPackageSetting(context: IActionContext, site: ParsedSite): Promise<void> {
    let updateSettings: boolean = false;
    const runFromPackageSettings: string[] = ['WEBSITE_RUN_FROM_PACKAGE', 'WEBSITE_RUN_FROM_ZIP'];
    const client = await site.createClient(context);
    const applicationSettings: StringDictionary = await client.listApplicationSettings();
    for (const settingName of runFromPackageSettings) {
        if (applicationSettings.properties && applicationSettings.properties[settingName]) {
            delete applicationSettings.properties[settingName];
            ext.outputChannel.appendLog(vscode.l10n.t('Deleting setting "{0}"...', settingName), { resourceName: site.fullName });
            updateSettings = true;
        }
    }
    if (updateSettings) {
        await client.updateApplicationSettings(applicationSettings);
    }
}
