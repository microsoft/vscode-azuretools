/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickInputButton, ThemeIcon } from "vscode";
import { DialogResponses } from "..";

export const resourcesProvider: string = 'Microsoft.Resources';
export const storageProvider: string = 'Microsoft.Storage';

export namespace AzExtQuickInputButtons {
    export const LearnMore: QuickInputButton = { iconPath: new ThemeIcon('question'), tooltip: DialogResponses.learnMore.title }
}
