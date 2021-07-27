/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementModels } from '@azure/arm-appservice';
import { IActionContext } from 'vscode-azureextensionui';

export interface AppSettingsClientProvider {
    createClient(context: IActionContext): Promise<IAppSettingsClient>;
}

export interface IAppSettingsClient {

    fullName: string;

    isLinux: boolean;

    listApplicationSettings(): Promise<WebSiteManagementModels.StringDictionary>;

    updateApplicationSettings(appSettings: WebSiteManagementModels.StringDictionary): Promise<WebSiteManagementModels.StringDictionary>;

    listSlotConfigurationNames?(): Promise<WebSiteManagementModels.SlotConfigNamesResource>;

    updateSlotConfigurationNames?(appSettings: WebSiteManagementModels.SlotConfigNamesResource): Promise<WebSiteManagementModels.SlotConfigNamesResource>;
}
