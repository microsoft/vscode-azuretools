/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { AzExtTreeItem, AzureParentTreeItem, ICreateChildImplContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { SiteClient } from '../SiteClient';
import { AppSettingsTreeItemBase } from './AppSettingsTreeItemBase';
import { AppSettingTreeItem } from './AppSettingTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

export function validateAppSettingKey(settings: StringDictionary, isLinux: boolean, newKey: string, oldKey?: string): string | undefined {
    if (isLinux && /[^\w\.]+/.test(newKey)) {
        return 'App setting names can only contain letters, numbers (0-9), periods ("."), and underscores ("_")';
    }

    newKey = newKey.trim();
    if (newKey.length === 0) {
        return 'App setting names must have at least one non-whitespace character.';
    }

    oldKey = oldKey ? oldKey.trim().toLowerCase() : oldKey;
    if (settings.properties && newKey.toLowerCase() !== oldKey) {
        for (const key of Object.keys(settings.properties)) {
            if (key.toLowerCase() === newKey.toLowerCase()) {
                return `Setting "${newKey}" already exists.`;
            }
        }
    }

    return undefined;
}

export class AppSettingsTreeItem extends AppSettingsTreeItemBase {

    public readonly _client: SiteClient;

    constructor(parent: AzureParentTreeItem<ISiteTreeRoot>) {
        super(parent, parent.root.client);
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        this._settings = await this._client.listApplicationSettings();
        const treeItems: AppSettingTreeItem[] = [];
        // tslint:disable-next-line:strict-boolean-expressions
        const properties: { [name: string]: string } = this._settings.properties || {};
        await Promise.all(Object.keys(properties).map(async (key: string) => {
            const appSettingTreeItem: AppSettingTreeItem = await AppSettingTreeItem.createAppSettingTreeItem(this, key, properties[key]);
            treeItems.push(appSettingTreeItem);
        }));

        return treeItems;
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AppSettingTreeItem> {
        // make a deep copy so settings are not cached if there's a failure
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));
        const newKey: string = await ext.ui.showInputBox({
            prompt: 'Enter new setting key',
            validateInput: (v: string): string | undefined => validateAppSettingKey(settings, this._client.isLinux, v)
        });

        const newValue: string = await ext.ui.showInputBox({
            prompt: `Enter setting value for "${newKey}"`
        });

        if (!settings.properties) {
            settings.properties = {};
        }

        context.showCreatingTreeItem(newKey);
        settings.properties[newKey] = newValue;

        this._settings = await this._client.updateApplicationSettings(settings);

        return await AppSettingTreeItem.createAppSettingTreeItem(this, newKey, newValue);
    }
}
