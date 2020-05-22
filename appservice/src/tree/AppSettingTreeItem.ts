/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SlotConfigNamesResource } from 'azure-arm-website/lib/models';
import { localize } from '../localize';
import { AppSettingsTreeItem } from './AppSettingsTreeItem';
import { AppSettingTreeItemBase } from './AppSettingTreeItemBase';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.toggleAppSettingVisibility'` that should be registered by each extension
 */
export class AppSettingTreeItem extends AppSettingTreeItemBase {

    public readonly parent: AppSettingsTreeItem;

    private constructor(parent: AppSettingsTreeItem, key: string, value: string) {
        super(parent, parent._client, key, value);
    }

    public static async createAppSettingTreeItem(parent: AppSettingsTreeItem, key: string, value: string): Promise<AppSettingTreeItem> {
        const ti: AppSettingTreeItem = new AppSettingTreeItem(parent, key, value);
        // check if it's a slot setting
        await ti.refreshImpl();
        return ti;
    }

    public async toggleSlotSetting(): Promise<void> {
        const slotSettings: SlotConfigNamesResource = await this.parent._client.listSlotConfigurationNames();
        if (!slotSettings.appSettingNames) {
            slotSettings.appSettingNames = [];
        }
        const slotSettingIndex: number = slotSettings.appSettingNames.findIndex((value: string) => { return value === this._key; });

        if (slotSettingIndex >= 0) {
            slotSettings.appSettingNames.splice(slotSettingIndex, 1);
        } else {
            slotSettings.appSettingNames.push(this._key);
        }

        await this.parent._client.updateSlotConfigurationNames(slotSettings);
        await this.refresh();
    }

    public async refreshImpl(): Promise<void> {
        const slotSettings: SlotConfigNamesResource = await this.parent._client.listSlotConfigurationNames();
        if (slotSettings.appSettingNames && slotSettings.appSettingNames.find((value: string) => { return value === this._key; })) {
            this.description = localize('slotSetting', 'Slot Setting');
        } else {
            this.description = undefined;
        }
    }
}
