/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickInputButton, ThemeIcon } from "vscode";
import { localize } from "./localize";

export const resourcesProvider: string = 'Microsoft.Resources';
export const storageProvider: string = 'Microsoft.Storage';
export const storageProviderType = "Microsoft.Storage/storageAccounts";
export const learnMore: string = localize('learnMore', "Learn more");

export namespace AzExtQuickInputButtons {
    export const LearnMore: QuickInputButton = { iconPath: new ThemeIcon('question'), tooltip: learnMore }
}
