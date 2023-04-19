/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { l10n, QuickInputButton, ThemeIcon } from "vscode";

export const learnMore: string = l10n.t("Learn more");

export const azToolsPrefix: string = "azureTools";
export const showContextValueSetting: string = "showContextValues";

export namespace AzExtQuickInputButtons {
    export const LearnMore: QuickInputButton = { iconPath: new ThemeIcon('question'), tooltip: learnMore }
}
