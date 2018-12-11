/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { AzureTreeItem, DialogResponses } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { AppSettingsTreeItem, validateAppSettingKey } from './AppSettingsTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

export class AppSettingTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'applicationSettingItem';
    public readonly contextValue: string = AppSettingTreeItem.contextValue;
    public readonly parent: AppSettingsTreeItem;
    public readonly commandId: string;

    private _key: string;
    private _value: string;
    private _hideValue: boolean;

    constructor(parent: AppSettingsTreeItem, key: string, value: string, commandId: string) {
        super(parent);
        this._key = key;
        this._value = value;
        this.commandId = commandId;
        this._hideValue = true;
    }
    public get id(): string {
        return this._key;
    }

    public get label(): string {
        return this._hideValue ? `${this._key}=Hidden value. Click to view.` : `${this._key}=${this._value}`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Item_16x_vscode.svg'),
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Item_16x_vscode.svg')
        };
    }

    public async edit(): Promise<void> {
        const newValue: string = await ext.ui.showInputBox({
            prompt: `Enter setting value for "${this._key}"`,
            value: this._value
        });

        this._value = newValue;
        await this.parent.editSettingItem(this._key, this._key, newValue);
        await this.refresh();
    }

    public async rename(): Promise<void> {
        const settings: StringDictionary = await this.parent.ensureSettings();

        const oldKey: string = this._key;
        const newKey: string = await ext.ui.showInputBox({
            prompt: `Enter a new name for "${oldKey}"`,
            value: this._key,
            validateInput: (v?: string): string | undefined => validateAppSettingKey(settings, v, oldKey)
        });

        this._key = newKey;
        await this.parent.editSettingItem(oldKey, newKey, this._value);
        await this.refresh();
    }

    public async deleteTreeItemImpl(): Promise<void> {
        await ext.ui.showWarningMessage(`Are you sure you want to delete setting "${this._key}"?`, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        await this.parent.deleteSettingItem(this._key);
    }
    public async toggleValueVisibility(): Promise<void> {
        this._hideValue = !this._hideValue;
        await this.refresh();
    }
}
