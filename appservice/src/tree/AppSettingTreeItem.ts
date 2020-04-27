/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SlotConfigNamesResource, StringDictionary } from 'azure-arm-website/lib/models';
import { AzureTreeItem, DialogResponses, IActionContext, IContextValue, TreeItemIconPath } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { AppSettingsTreeItem, validateAppSettingKey } from './AppSettingsTreeItem';
import { getThemedIconPath } from './IconPath';
import { ISiteTreeRoot } from './ISiteTreeRoot';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.toggleAppSettingVisibility'` that should be registered by each extension
 */
export class AppSettingTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValueId: string = 'appSetting';
    public readonly parent: AppSettingsTreeItem;

    private _key: string;
    private _value: string;
    private _hideValue: boolean;

    private constructor(parent: AppSettingsTreeItem, key: string, value: string) {
        super(parent);
        this._key = key;
        this._value = value;
        this._hideValue = true;
    }

    public static async createAppSettingTreeItem(parent: AppSettingsTreeItem, key: string, value: string): Promise<AppSettingTreeItem> {
        const ti: AppSettingTreeItem = new AppSettingTreeItem(parent, key, value);
        // check if it's a slot setting
        await ti.refreshImpl();
        return ti;
    }

    public get contextValue(): IContextValue {
        return { id: AppSettingTreeItem.contextValueId };
    }

    public get id(): string {
        return this._key;
    }

    public get label(): string {
        return this._hideValue ? `${this._key}=Hidden value. Click to view.` : `${this._key}=${this._value}`;
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('constant');
    }

    public get commandId(): string {
        return ext.prefix + '.toggleAppSettingVisibility';
    }

    public async edit(context: IActionContext): Promise<void> {
        const newValue: string = await ext.ui.showInputBox({
            prompt: `Enter setting value for "${this._key}"`,
            value: this._value
        });

        await this.parent.editSettingItem(this._key, this._key, newValue, context);
        this._value = newValue;
        await this.refresh();
    }

    public async rename(context: IActionContext): Promise<void> {
        const settings: StringDictionary = await this.parent.ensureSettings(context);

        const oldKey: string = this._key;
        const newKey: string = await ext.ui.showInputBox({
            prompt: `Enter a new name for "${oldKey}"`,
            value: this._key,
            validateInput: (v?: string): string | undefined => validateAppSettingKey(settings, this.root.client, v, oldKey)
        });

        await this.parent.editSettingItem(oldKey, newKey, this._value, context);
        this._key = newKey;
        await this.refresh();
    }

    public async deleteAppSetting(context: IActionContext): Promise<void> {
        await this.withDeleteProgress(async () => {
            await ext.ui.showWarningMessage(`Are you sure you want to delete setting "${this._key}"?`, { modal: true }, DialogResponses.deleteResponse);
            await this.parent.deleteSettingItem(this._key, context);
        });
    }

    public async toggleValueVisibility(): Promise<void> {
        this._hideValue = !this._hideValue;
        await this.refresh();
    }

    public async toggleSlotSetting(): Promise<void> {
        const slotSettings: SlotConfigNamesResource = await this.root.client.listSlotConfigurationNames();
        if (!slotSettings.appSettingNames) {
            slotSettings.appSettingNames = [];
        }
        const slotSettingIndex: number = slotSettings.appSettingNames.findIndex((value: string) => { return value === this._key; });

        if (slotSettingIndex >= 0) {
            slotSettings.appSettingNames.splice(slotSettingIndex, 1);
        } else {
            slotSettings.appSettingNames.push(this._key);
        }

        await this.root.client.updateSlotConfigurationNames(slotSettings);
        await this.refresh();
    }

    public async refreshImpl(): Promise<void> {
        const slotSettings: SlotConfigNamesResource = await this.root.client.listSlotConfigurationNames();
        if (slotSettings.appSettingNames && slotSettings.appSettingNames.find((value: string) => { return value === this._key; })) {
            this.description = localize('slotSetting', 'Slot Setting');
        } else {
            this.description = undefined;
        }
    }
}
