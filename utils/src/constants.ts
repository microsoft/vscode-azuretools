/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { l10n, QuickInputButton, ThemeColor, ThemeIcon } from "vscode";

export const learnMore: string = l10n.t("Learn more");

export const azToolsPrefix: string = "azureTools";
export const showContextValueSetting: string = "showContextValues";

export namespace AzExtQuickInputButtons {
    export const LearnMore: QuickInputButton = { iconPath: new ThemeIcon('question'), tooltip: learnMore }
}

export const activitySuccessContext: string = 'activity:success';
export const activityFailContext: string = 'activity:fail';
export const activityProgressContext: string = 'activity:progress';

export const activityInfoIcon: ThemeIcon = new ThemeIcon('info', new ThemeColor('charts.blue'));
export const activitySuccessIcon: ThemeIcon = new ThemeIcon('pass', new ThemeColor('testing.iconPassed'));
export const activityFailIcon: ThemeIcon = new ThemeIcon('error', new ThemeColor('testing.iconFailed'));
export const activityProgressIcon: ThemeIcon = new ThemeIcon('loading~spin');
