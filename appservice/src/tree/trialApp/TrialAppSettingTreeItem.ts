/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { AzExtTreeItem, DialogResponses, IActionContext, TreeItemIconPath } from 'vscode-azureextensionui';
import { validateAppSettingKey } from '../..';
import { getThemedIconPath } from '../IconPath';
import { ext } from './../../extensionVariables';
import { TrialAppSettingsTreeItem } from './TrialAppSettingsTreeItem';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.toggleAppSettingVisibility'` that should be registered by each extension
 */
export class TrialAppSettingTreeItem extends AzExtTreeItem {
    public static contextValue: string = 'applicationSettingItem';
    public readonly contextValue: string = TrialAppSettingTreeItem.contextValue;
    public readonly parent: TrialAppSettingsTreeItem;

    private _key: string;
    private _value: string;
    private _hideValue: boolean;

    private constructor(parent: TrialAppSettingsTreeItem, key: string, value: string) {
        super(parent);
        this._key = key;
        this._value = value;
        this._hideValue = true;
    }

    public static async createAppSettingTreeItem(parent: TrialAppSettingsTreeItem, key: string, value: string): Promise<TrialAppSettingTreeItem> {
        return new TrialAppSettingTreeItem(parent, key, value);
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
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.parent.ensureSettings(context)));

        const oldKey: string = this._key;
        const newKey: string = await ext.ui.showInputBox({
            prompt: `Enter a new name for "${oldKey}"`,
            value: this._key,
            validateInput: (v?: string): string | undefined => validateAppSettingKey(settings, this.parent.client, v, oldKey)
        });

        await this.parent.editSettingItem(oldKey, newKey, this._value, context);
        this._key = newKey;
        await this.refresh();
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

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        await ext.ui.showWarningMessage(`Are you sure you want to delete setting "${this._key}"?`, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        await this.parent.deleteSettingItem(this._key, context);
    }

    public get commandId(): string {
        return ext.prefix + '.toggleAppSettingVisibility';
    }

    public async toggleValueVisibility(): Promise<void> {
        this._hideValue = !this._hideValue;
        await this.refresh();
    }
}
