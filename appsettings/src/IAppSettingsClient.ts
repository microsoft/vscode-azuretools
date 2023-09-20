/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SlotConfigNamesResource, StringDictionary } from '@azure/arm-appservice';
import { IActionContext } from '@microsoft/vscode-azext-utils';

export interface AppSettingsClientProvider {
    createClient(context: IActionContext): Promise<IAppSettingsClient>;
}

export interface IAppSettingsClient {
    fullName: string;

    isLinux: boolean;

    listApplicationSettings(): Promise<StringDictionary>;

    updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary>;

    listSlotConfigurationNames?(): Promise<SlotConfigNamesResource>;

    updateSlotConfigurationNames?(appSettings: SlotConfigNamesResource): Promise<SlotConfigNamesResource>;
}
