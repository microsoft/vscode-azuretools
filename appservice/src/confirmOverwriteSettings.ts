/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DialogResponses, IActionContext } from '@microsoft/vscode-azext-utils';
import { l10n, MessageItem } from 'vscode';
import { ext } from './extensionVariables';

export async function confirmOverwriteSettings(context: IActionContext, sourceSettings: { [key: string]: string }, destinationSettings: { [key: string]: string }, destinationName: string): Promise<void> {
    let suppressPrompt: boolean = false;
    let overwriteSetting: boolean = false;

    const addedKeys: string[] = [];
    const updatedKeys: string[] = [];
    const userIgnoredKeys: string[] = [];
    const matchingKeys: string[] = [];

    for (const srcKey of Object.keys(sourceSettings)) {
        // App setting keys are case insensitive, so find the destination key that matches
        const destKey = Object.keys(destinationSettings).find(dk => srcKey.toLowerCase() === dk.toLowerCase()) || srcKey;

        if (destinationSettings[destKey] === undefined) {
            addedKeys.push(destKey);
            destinationSettings[destKey] = sourceSettings[srcKey];
        } else if (destinationSettings[destKey] === sourceSettings[srcKey]) {
            matchingKeys.push(destKey);
        } else if (sourceSettings[srcKey]) { // ignore empty settings
            if (!suppressPrompt) {
                const yesToAll: MessageItem = { title: l10n.t('Yes to all') };
                const noToAll: MessageItem = { title: l10n.t('No to all') };
                const message: string = l10n.t('Setting "{0}" already exists in "{1}". Overwrite?', destKey, destinationName);
                const result: MessageItem = await context.ui.showWarningMessage(message, { modal: true, stepName: 'confirmOverwriteSetting' }, DialogResponses.yes, yesToAll, DialogResponses.no, noToAll);
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
                updatedKeys.push(destKey);
                destinationSettings[destKey] = sourceSettings[srcKey];
            } else {
                userIgnoredKeys.push(destKey);
            }
        }
    }

    if (addedKeys.length > 0) {
        ext.outputChannel.appendLog(l10n.t('Added the following settings:'));
        addedKeys.forEach(logKey);
    }

    if (updatedKeys.length > 0) {
        ext.outputChannel.appendLog(l10n.t('Updated the following settings:'));
        updatedKeys.forEach(logKey);
    }

    if (matchingKeys.length > 0) {
        ext.outputChannel.appendLog(l10n.t('Ignored the following settings that were already the same:'));
        matchingKeys.forEach(logKey);
    }

    if (userIgnoredKeys.length > 0) {
        ext.outputChannel.appendLog(l10n.t('Ignored the following settings based on user input:'));
        userIgnoredKeys.forEach(logKey);
    }

    if (Object.keys(destinationSettings).length > Object.keys(sourceSettings).length) {
        ext.outputChannel.appendLog(l10n.t('WARNING: This operation will not delete any settings in "{0}". You must manually delete settings if desired.', destinationName));
    }
}

function logKey(key: string): void {
    ext.outputChannel.appendLine(`- ${key}`);
}
