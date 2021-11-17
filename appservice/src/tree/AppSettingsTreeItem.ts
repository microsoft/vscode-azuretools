/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WebSiteManagementModels } from '@azure/arm-appservice';
import { ThemeIcon } from 'vscode';
import { AzExtParentTreeItem, AzExtTreeItem, IActionContext, ICreateChildImplContext, TreeItemIconPath } from 'vscode-azureextensionui';
import { AppSettingsClientProvider, IAppSettingsClient } from '../IAppSettingsClient';
import { AppSettingTreeItem } from './AppSettingTreeItem';

export function validateAppSettingKey(settings: WebSiteManagementModels.StringDictionary, client: IAppSettingsClient, newKey: string, oldKey?: string): string | undefined {
    if (client.isLinux && /[^\w\.]+/.test(newKey)) {
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
                return `App setting name "${newKey}" already exists.`;
            }
        }
    }

    return undefined;
}

export class AppSettingsTreeItem extends AzExtParentTreeItem {
    public static contextValue: string = 'applicationSettings';
    public readonly label: string = 'Application Settings';
    public readonly childTypeLabel: string = 'App Setting';
    public readonly contextValue: string = AppSettingsTreeItem.contextValue;
    public readonly clientProvider: AppSettingsClientProvider;
    public readonly supportsSlots: boolean;
    public suppressMaskLabel: boolean = true;
    private _settings: WebSiteManagementModels.StringDictionary | undefined;
    private readonly _settingsToHide: string[] | undefined;

    constructor(parent: AzExtParentTreeItem, clientProvider: AppSettingsClientProvider, supportsSlots: boolean = true, settingsToHide?: string[]) {
        super(parent);
        this.clientProvider = clientProvider;
        this.supportsSlots = supportsSlots;
        this._settingsToHide = settingsToHide;
    }

    public get id(): string {
        return 'configuration';
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('settings');
    }
    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const client = await this.clientProvider.createClient(context);
        this._settings = await client.listApplicationSettings();
        const treeItems: AppSettingTreeItem[] = [];
        const properties: { [name: string]: string } = this._settings.properties || {};
        await Promise.all(Object.keys(properties).map(async (key: string) => {
            const appSettingTreeItem: AppSettingTreeItem = await AppSettingTreeItem.createAppSettingTreeItem(context, this, key, properties[key]);
            if (!this._settingsToHide?.includes(key)) {
                treeItems.push(appSettingTreeItem);
            }
        }));

        return treeItems;
    }

    public async editSettingItem(oldKey: string, newKey: string, value: string, context: IActionContext): Promise<void> {
        // make a deep copy so settings are not cached if there's a failure
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const settings: WebSiteManagementModels.StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));
        if (settings.properties) {
            if (oldKey !== newKey) {
                delete settings.properties[oldKey];
            }
            settings.properties[newKey] = value;
        }

        const client = await this.clientProvider.createClient(context);
        this._settings = await client.updateApplicationSettings(settings);
    }

    public async deleteSettingItem(key: string, context: IActionContext): Promise<void> {
        // make a deep copy so settings are not cached if there's a failure
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const settings: WebSiteManagementModels.StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));

        if (settings.properties) {
            delete settings.properties[key];
        }

        const client = await this.clientProvider.createClient(context);
        this._settings = await client.updateApplicationSettings(settings);
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzExtTreeItem> {
        const client = await this.clientProvider.createClient(context);
        // make a deep copy so settings are not cached if there's a failure
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const settings: WebSiteManagementModels.StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));
        const newKey: string = await context.ui.showInputBox({
            prompt: 'Enter new app setting name',
            stepName: 'appSettingName',
            validateInput: (v: string): string | undefined => validateAppSettingKey(settings, client, v)
        });

        const newValue: string = await context.ui.showInputBox({
            prompt: `Enter value for "${newKey}"`,
            stepName: 'appSettingValue'
        });

        if (!settings.properties) {
            settings.properties = {};
        }

        context.showCreatingTreeItem(newKey);
        settings.properties[newKey] = newValue;

        this._settings = await client.updateApplicationSettings(settings);

        return await AppSettingTreeItem.createAppSettingTreeItem(context, this, newKey, newValue);
    }

    public async ensureSettings(context: IActionContext): Promise<WebSiteManagementModels.StringDictionary> {
        if (!this._settings) {
            await this.getCachedChildren(context);
        }

        return <WebSiteManagementModels.StringDictionary>this._settings;
    }
}
