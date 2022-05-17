/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SlotConfigNamesResource, StringDictionary } from '@azure/arm-appservice';
import { AzExtTreeItem, createContextValue, DialogResponses, IActionContext, TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { ThemeIcon } from 'vscode';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AppSettingsTreeItem, validateAppSettingKey } from './AppSettingsTreeItem';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.toggleAppSettingVisibility'` that should be registered by each extension
 */
export class AppSettingTreeItem extends AzExtTreeItem {
    public static contextValue: string = 'applicationSettingItem';
    public static contextValueNoSlots: string = 'applicationSettingItemNoSlots';
    public get contextValue(): string {
        const contextValue = this.parent.supportsSlots ? AppSettingTreeItem.contextValue : AppSettingTreeItem.contextValueNoSlots;
        return createContextValue([contextValue, ...this.parent.contextValuesToAdd]);
    }
    public readonly parent: AppSettingsTreeItem;

    private _key: string;
    private _value: string;
    private _hideValue: boolean;

    private constructor(parent: AppSettingsTreeItem, key: string, value: string) {
        super(parent);
        this._key = key;
        this._value = value;
        this._hideValue = true;
        this.valuesToMask.push(key, value);
    }

    public static async createAppSettingTreeItem(context: IActionContext, parent: AppSettingsTreeItem, key: string, value: string): Promise<AppSettingTreeItem> {
        const ti: AppSettingTreeItem = new AppSettingTreeItem(parent, key, value);
        // check if it's a slot setting
        await ti.refreshImpl(context);
        return ti;
    }
    public get id(): string {
        return this._key;
    }

    public get label(): string {
        return this._hideValue ? `${this._key}=Hidden value. Click to view.` : `${this._key}=${this._value}`;
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('symbol-constant');
    }

    public get commandId(): string {
        return ext.prefix + '.toggleAppSettingVisibility';
    }

    public async edit(context: IActionContext): Promise<void> {
        const newValue: string = await context.ui.showInputBox({
            prompt: `Enter setting value for "${this._key}"`,
            stepName: 'appSettingValue',
            value: this._value
        });

        await this.parent.editSettingItem(this._key, this._key, newValue, context);
        this._value = newValue;
        await this.refresh(context);
    }

    public async rename(context: IActionContext): Promise<void> {
        const settings: StringDictionary = await this.parent.ensureSettings(context);

        const client = await this.parent.clientProvider.createClient(context);
        const oldKey: string = this._key;
        const newKey: string = await context.ui.showInputBox({
            prompt: `Enter a new name for "${oldKey}"`,
            stepName: 'appSettingName',
            value: this._key,
            validateInput: (v: string): string | undefined => validateAppSettingKey(settings, client, v, oldKey)
        });

        await this.parent.editSettingItem(oldKey, newKey, this._value, context);
        this._key = newKey;
        await this.refresh(context);
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        await context.ui.showWarningMessage(`Are you sure you want to delete setting "${this._key}"?`, { modal: true, stepName: 'confirmDelete' }, DialogResponses.deleteResponse);
        await this.parent.deleteSettingItem(this._key, context);
    }

    public async toggleValueVisibility(context: IActionContext): Promise<void> {
        this._hideValue = !this._hideValue;
        await this.refresh(context);
    }

    public async toggleSlotSetting(context: IActionContext): Promise<void> {
        const client = await this.parent.clientProvider.createClient(context);
        if (client.updateSlotConfigurationNames && client.listSlotConfigurationNames) {
            const slotSettings: SlotConfigNamesResource = await client.listSlotConfigurationNames();
            if (!slotSettings.appSettingNames) {
                slotSettings.appSettingNames = [];
            }
            const slotSettingIndex: number = slotSettings.appSettingNames.findIndex((value: string) => { return value === this._key; });

            if (slotSettingIndex >= 0) {
                slotSettings.appSettingNames.splice(slotSettingIndex, 1);
            } else {
                slotSettings.appSettingNames.push(this._key);
            }

            await client.updateSlotConfigurationNames(slotSettings);
            await this.refresh(context);
        } else {
            throw Error(localize('toggleSlotSettingsNotSupported', 'Toggling slot settings is not supported.'));
        }
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        const client = await this.parent.clientProvider.createClient(context);
        if (client.listSlotConfigurationNames) {
            const slotSettings: SlotConfigNamesResource = await client.listSlotConfigurationNames();
            if (slotSettings.appSettingNames && slotSettings.appSettingNames.find((value: string) => { return value === this._key; })) {
                this.description = localize('slotSetting', 'Slot Setting');
            } else {
                this.description = undefined;
            }
        }
    }
}
