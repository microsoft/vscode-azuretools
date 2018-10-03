/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { AzureTreeItem, DialogResponses } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { AppSettingsTreeItem } from './AppSettingsTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

export class AppSettingTreeItem extends AzureTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'applicationSettingItem';
    public readonly contextValue: string = AppSettingTreeItem.contextValue;
    public readonly parent: AppSettingsTreeItem;

    private key: string;
    private value: string;

    constructor(parent: AppSettingsTreeItem, key: string, value: string) {
        super(parent);
        this.key = key;
        this.value = value;
    }

    public get id(): string {
        return this.key;
    }

    public get label(): string {
        return `${this.key}=${this.value}`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Item_16x_vscode.svg'),
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Item_16x_vscode.svg')
        };
    }

    public async edit(): Promise<void> {
        const newValue: string = await ext.ui.showInputBox({
            prompt: `Enter setting value for "${this.key}"`,
            value: this.value
        });

        this.value = newValue;
        await this.parent.editSettingItem(this.key, this.key, newValue);
        await this.refresh();
    }

    public async rename(): Promise<void> {
        const settings: StringDictionary = await this.parent.ensureSettings();

        const oldKey: string = this.key;
        const newKey: string = await ext.ui.showInputBox({
            prompt: `Enter a new name for "${oldKey}"`,
            value: this.key,
            validateInput: (v?: string): string | undefined => this.parent.validateNewKeyInput(settings, v, oldKey)
        });

        this.key = newKey;
        await this.parent.editSettingItem(oldKey, newKey, this.value);
        await this.refresh();
    }

    public async deleteTreeItemImpl(): Promise<void> {
        await ext.ui.showWarningMessage(`Are you sure you want to delete setting "${this.key}"?`, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        await this.parent.deleteSettingItem(this.key);
    }
}
