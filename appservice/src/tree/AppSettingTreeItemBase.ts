/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { AzExtTreeItem, DialogResponses, IActionContext, TreeItemIconPath } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { IAppSettingsClient } from '../IAppSettingsClient';
import { validateAppSettingKey } from './AppSettingsTreeItem';
import { AppSettingsTreeItemBase } from './AppSettingsTreeItemBase';
import { getThemedIconPath } from './IconPath';

export abstract class AppSettingTreeItemBase extends AzExtTreeItem {
    public static contextValue: string = 'applicationSettingItem';
    public readonly contextValue: string = AppSettingTreeItemBase.contextValue;

    public readonly _client: IAppSettingsClient;

    public readonly parent: AppSettingsTreeItemBase;

    public get id(): string {
        return this._key;
    }

    public get commandId(): string {
        return ext.prefix + '.toggleAppSettingVisibility';
    }

    public get label(): string {
        return this._hideValue ? `${this._key}=Hidden value. Click to view.` : `${this._key}=${this._value}`;
    }

    protected _key: string;
    protected _value: string;
    protected _hideValue: boolean;

    constructor(parent: AppSettingsTreeItemBase, client: IAppSettingsClient, key: string, value: string) {
        super(parent);
        this._client = client;
        this._key = key;
        this._value = value;
        this._hideValue = true;
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('constant');
    }

    public async rename(context: IActionContext): Promise<void> {
        const settings: StringDictionary = await this.parent.ensureSettings(context);

        const oldKey: string = this._key;
        const newKey: string = await ext.ui.showInputBox({
            prompt: `Enter a new name for "${oldKey}"`,
            value: this._key,
            validateInput: (v: string): string | undefined => validateAppSettingKey(settings, this._client.isLinux, v, oldKey)
        });

        await this.parent.editSettingItem(oldKey, newKey, this._value, context);
        this._key = newKey;
        await this.refresh();
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

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        await ext.ui.showWarningMessage(`Are you sure you want to delete setting "${this._key}"?`, { modal: true }, DialogResponses.deleteResponse);
        await this.parent.deleteSettingItem(this._key, context);
    }

    public async toggleValueVisibility(): Promise<void> {
        this._hideValue = !this._hideValue;
        await this.refresh();
    }
}
