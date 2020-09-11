/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from "@azure/arm-appservice";
import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import { ext } from "../extensionVariables";
import { localize } from "../localize";
import { AppSettingsTreeItem } from "../tree/AppSettingsTreeItem";
import { confirmOverwriteSettings } from "./confirmOverwriteSettings";
import { IAppSettingsClient } from "./IAppSettingsClient";
import { ILocalSettingsJson } from "./ILocalSettingsJson";

export async function downloadAppSettings(node: AppSettingsTreeItem, localSettingsFileName: string, localSettingsPath: string): Promise<void> {
    const client: IAppSettingsClient = node.client;
    const localSettingsUri: vscode.Uri = vscode.Uri.file(localSettingsPath);
    const localSettings: ILocalSettingsJson = <ILocalSettingsJson>await fse.readJson(localSettingsPath);

    if (!localSettings.Values) {
        localSettings.Values = {};
    }

    const remoteSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();

    ext.outputChannel.appendLog(localize('downloadingSettings', 'Downloading settings...'), { resourceName: client.fullName });
    if (remoteSettings.properties) {
        await confirmOverwriteSettings(remoteSettings.properties, localSettings.Values, localSettingsFileName);
    }

    await node.runWithTemporaryDescription(localize('downloading', 'Downloading...'), async () => {
        await fse.ensureFile(localSettingsPath);
        await fse.writeJson(localSettingsPath, localSettings, { spaces: 2 });
    });

    ext.outputChannel.appendLog(localize('downloadedSettings', 'Successfully downloaded settings.'), { resourceName: client.fullName });
    const openFile: string = localize('openFile', 'Open File');
    const viewOutput: string = localize('viewOutput', 'View Output');
    // don't wait
    vscode.window.showInformationMessage(localize('downloadedSettingsFrom', 'Successfully downloaded settings from "{0}".', client.fullName), openFile, viewOutput).then(async result => {
        if (result === openFile) {
            const doc: vscode.TextDocument = await vscode.workspace.openTextDocument(localSettingsUri);
            await vscode.window.showTextDocument(doc);
        } else if (result === viewOutput) {
            ext.outputChannel.show();
        }
    });
}
