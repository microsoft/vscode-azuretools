/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from 'vscode';
import { DialogResponses } from 'vscode-azureextensionui';
import { ext } from './extensionVariables';
import { localize } from './localize';

export async function confirmOverwriteSettings(sourceSettings: { [key: string]: string }, destinationSettings: { [key: string]: string }, destinationName: string): Promise<void> {
    let suppressPrompt: boolean = false;
    let overwriteSetting: boolean = false;

    const addedKeys: string[] = [];
    const updatedKeys: string[] = [];
    const userIgnoredKeys: string[] = [];
    const matchingKeys: string[] = [];

    for (const key of Object.keys(sourceSettings)) {
        if (destinationSettings[key] === undefined) {
            addedKeys.push(key);
            destinationSettings[key] = sourceSettings[key];
        } else if (destinationSettings[key] !== sourceSettings[key]) {
            if (!suppressPrompt) {
                const yesToAll: MessageItem = { title: localize('yesToAll', 'Yes to all') };
                const noToAll: MessageItem = { title: localize('noToAll', 'No to all') };
                const message: string = localize('overwriteSetting', 'Setting "{0}" already exists in "{1}". Overwrite?', key, destinationName);
                const result: MessageItem = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.yes, yesToAll, DialogResponses.no, noToAll);
                if (result === DialogResponses.yes) {
                    overwriteSetting = true;
                } else if (result === yesToAll) {
                    overwriteSetting = true;
                    suppressPrompt = true;
                } else if (result === DialogResponses.no) {
                    overwriteSetting = false;
                } else if (result === noToAll) {
                    overwriteSetting = false;
                    suppressPrompt = true;
                }
            }

            if (overwriteSetting) {
                updatedKeys.push(key);
                destinationSettings[key] = sourceSettings[key];
            } else {
                userIgnoredKeys.push(key);
            }
        } else {
            matchingKeys.push(key);
        }
    }

    if (addedKeys.length > 0) {
        ext.outputChannel.appendLine(localize('addedKeys', 'Added the following settings:'));
        addedKeys.forEach(logKey);
    }

    if (updatedKeys.length > 0) {
        ext.outputChannel.appendLine(localize('updatedKeys', 'Updated the following settings:'));
        updatedKeys.forEach(logKey);
    }

    if (matchingKeys.length > 0) {
        ext.outputChannel.appendLine(localize('matchingKeys', 'Ignored the following settings that were already the same:'));
        matchingKeys.forEach(logKey);
    }

    if (userIgnoredKeys.length > 0) {
        ext.outputChannel.appendLine(localize('userIgnoredKeys', 'Ignored the following settings based on user input:'));
        userIgnoredKeys.forEach(logKey);
    }

    if (Object.keys(destinationSettings).length > Object.keys(sourceSettings).length) {
        ext.outputChannel.appendLine(localize('noDeleteKey', 'WARNING: This operation will not delete any settings in "{0}". You must manually delete settings if desired.', destinationName));
    }

    function logKey(key: string): void {
        ext.outputChannel.appendLine(`- ${key}`);
    }
}
