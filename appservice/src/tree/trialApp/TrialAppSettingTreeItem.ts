/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, TreeItemIconPath } from 'vscode-azureextensionui';
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

    public async toggleValueVisibility(): Promise<void> {
        this._hideValue = !this._hideValue;
        await this.refresh();
    }
}
