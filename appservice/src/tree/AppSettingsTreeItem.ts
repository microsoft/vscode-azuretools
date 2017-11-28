/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { StringDictionary } from 'azure-arm-website/lib/models';
import * as path from 'path';
import * as vscode from 'vscode';
import { IAzureNode, IAzureParentTreeItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { SiteWrapper } from '../SiteWrapper';
import { nodeUtils } from '../utils/nodeUtils';
import { AppSettingTreeItem } from './AppSettingTreeItem';

export class AppSettingsTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'applicationSettings';
    public readonly label: string = 'Application Settings';
    public readonly childTypeLabel: string = 'App Setting';
    public readonly contextValue: string = AppSettingsTreeItem.contextValue;
    private readonly _siteWrapper: SiteWrapper;
    private _settings: StringDictionary;

    constructor(siteWrapper: SiteWrapper) {
        this._siteWrapper = siteWrapper;
    }

    public get id(): string {
        return `${this._siteWrapper.id}/application`;
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'AppSettings_color.svg'),
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'AppSettings_color.svg')
        };
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public async loadMoreChildren(node: IAzureNode<AppSettingsTreeItem>): Promise<IAzureTreeItem[]> {
        const client: WebSiteManagementClient = nodeUtils.getWebSiteClient(node);
        this._settings = this._siteWrapper.slotName ?
            await client.webApps.listApplicationSettingsSlot(this._siteWrapper.resourceGroup, this._siteWrapper.name, this._siteWrapper.slotName) :
            await client.webApps.listApplicationSettings(this._siteWrapper.resourceGroup, this._siteWrapper.name);

        const treeItems: IAzureTreeItem[] = [];
        Object.keys(this._settings.properties).forEach((key: string) => {
            treeItems.push(new AppSettingTreeItem(key, this._settings.properties[key]));
        });

        return treeItems;
    }

    public async editSettingItem(client: WebSiteManagementClient, oldKey: string, newKey: string, value: string): Promise<void> {
        if (this._settings.properties) {
            if (oldKey !== newKey) {
                delete this._settings.properties[oldKey];
            }
            this._settings.properties[newKey] = value;
        }
        await this.applySettings(client);
    }

    public async deleteSettingItem(client: WebSiteManagementClient, key: string): Promise<void> {
        if (this._settings.properties) {
            delete this._settings.properties[key];
        }
        await this.applySettings(client);
    }

    public async createChild(node: IAzureNode<AppSettingsTreeItem>, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        if (!this._settings) {
            await this.loadMoreChildren(node);
        }

        const newKey: string | undefined = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Enter new setting key',
            validateInput: (v?: string): string | undefined => this.validateNewKeyInput(v)
        });

        if (newKey === undefined) {
            throw new UserCancelledError();
        }

        const newValue: string | undefined = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: `Enter setting value for "${newKey}"`
        });

        if (newValue === undefined) {
            throw new UserCancelledError();
        }

        if (!this._settings.properties) {
            this._settings.properties = {};
        }

        showCreatingNode(newKey);
        this._settings.properties[newKey] = newValue;
        await this.applySettings(nodeUtils.getWebSiteClient(node));
        return new AppSettingTreeItem(newKey, newValue);
    }

    public validateNewKeyInput(newKey?: string, oldKey?: string): string | undefined {
        newKey = newKey ? newKey.trim() : '';
        oldKey = oldKey ? oldKey.trim().toLowerCase() : oldKey;
        if (newKey.length === 0) {
            return 'Key must have at least one non-whitespace character.';
        }
        if (this._settings.properties && newKey.toLowerCase() !== oldKey) {
            for (const key of Object.keys(this._settings.properties)) {
                if (key.toLowerCase() === newKey.toLowerCase()) {
                    return `Setting "${newKey}" already exists.`;
                }
            }
        }

        return undefined;
    }

    private async applySettings(client: WebSiteManagementClient): Promise<StringDictionary> {
        return this._siteWrapper.slotName ?
            await client.webApps.updateApplicationSettingsSlot(this._siteWrapper.resourceGroup, this._siteWrapper.name, this._settings, this._siteWrapper.slotName) :
            await client.webApps.updateApplicationSettings(this._siteWrapper.resourceGroup, this._siteWrapper.name, this._settings);
    }
}
