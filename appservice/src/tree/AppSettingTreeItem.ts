/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { DialogResponses, IAzureNode, IAzureTreeItem } from 'vscode-azureextensionui';
import { AppSettingsTreeItem } from './AppSettingsTreeItem';

export class AppSettingTreeItem implements IAzureTreeItem {
    public static contextValue: string = 'applicationSettingItem';
    public readonly contextValue: string = AppSettingTreeItem.contextValue;

    private key: string;
    private value: string;

    constructor(key: string, value: string) {
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

    public async edit(node: IAzureNode): Promise<void> {
        const newValue: string = await node.ui.showInputBox({
            prompt: `Enter setting value for "${this.key}"`,
            value: this.value
        });

        this.value = newValue;
        await (<AppSettingsTreeItem>node.parent.treeItem).editSettingItem(this.key, this.key, newValue);
        await node.refresh();
    }

    public async rename(node: IAzureNode): Promise<void> {
        const oldKey: string = this.key;
        const newKey: string = await node.ui.showInputBox({
            prompt: `Enter a new name for "${oldKey}"`,
            value: this.key,
            validateInput: (v?: string): string | undefined => (<AppSettingsTreeItem>node.parent.treeItem).validateNewKeyInput(v, oldKey)
        });

        this.key = newKey;
        await (<AppSettingsTreeItem>node.parent.treeItem).editSettingItem(oldKey, newKey, this.value);
        await node.refresh();
    }

    public async deleteTreeItem(node: IAzureNode): Promise<void> {
        await node.ui.showWarningMessage(`Are you sure you want to delete setting "${this.key}"?`, DialogResponses.deleteResponse, DialogResponses.cancel);
        await (<AppSettingsTreeItem>node.parent.treeItem).deleteSettingItem(this.key);
    }
}
