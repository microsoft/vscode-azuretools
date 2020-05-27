/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SlotConfigNamesResource, StringDictionary } from 'azure-arm-website/lib/models';

export interface IAppSettingsClient {

    fullName: string;

    isLinux: boolean;

    listApplicationSettings(): Promise<StringDictionary>;

    updateApplicationSettings(appSettings: StringDictionary): Promise<StringDictionary>;

    listSlotConfigurationNames?(): Promise<SlotConfigNamesResource>;

    updateSlotConfigurationNames?(appSettings: SlotConfigNamesResource): Promise<SlotConfigNamesResource>;
}
