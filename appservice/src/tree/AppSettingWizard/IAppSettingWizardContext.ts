/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from "azure-arm-website/lib/models";
import { ISubscriptionWizardContext, ITreeItemWizardContext } from "vscode-azureextensionui";
import { AppSettingsTreeItem } from "../AppSettingsTreeItem";

export interface IAppSettingWizardContext extends ISubscriptionWizardContext, ITreeItemWizardContext {
    appSettings: StringDictionary;
    newKey?: string;
    newValue?: string;
    appSettingsTreeItem: AppSettingsTreeItem;
}
