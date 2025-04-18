/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { StringDictionary } from '@azure/arm-appservice';
import { AzExtParentTreeItem, AzExtTreeItem, createContextValue, GenericTreeItem, IActionContext, ICreateChildImplContext, TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ThemeIcon } from 'vscode';
import { AppSettingsClientProvider, IAppSettingsClient } from '../IAppSettingsClient';
import { AppSettingTreeItem, isSettingConnectionString } from './AppSettingTreeItem';

export function validateAppSettingKey(settings: StringDictionary, client: IAppSettingsClient, newKey: string, oldKey?: string): string | undefined {
    if (client.isLinux && /[^\w\.]+/.test(newKey)) {
        return 'App setting names can only contain letters, numbers (0-9), periods ("."), and underscores ("_")';
    }

    if (client.isContainer && !(/^[-._a-zA-Z][-._a-zA-Z0-9]*$/.test(newKey))) {
        return 'App setting names must begin with a letter, period ("."), or underscore ("_") and can only contain letters, numbers (0-9), periods ("."), and underscores ("_")';
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

export function validateAppSettingValue(value: string): string | undefined {
    if (!value.trim()) {
        return vscode.l10n.t('App setting values cannot be null, undefined or an empty string.');
    }

    return undefined;
}

interface AppSettingsTreeItemOptions {
    supportsSlots?: boolean;
    settingsToHide?: string[];
    contextValuesToAdd?: string[];
}

export class AppSettingsTreeItem extends AzExtParentTreeItem {
    public static contextValue: string = 'applicationSettings';
    public label: string = vscode.l10n.t('Application Settings');
    public readonly childTypeLabel: string = 'App Setting';
    public readonly clientProvider: AppSettingsClientProvider;
    public readonly supportsSlots: boolean;
    public suppressMaskLabel: boolean = true;
    private _settings: StringDictionary | undefined;
    private readonly _settingsToHide: string[] | undefined;
    public readonly contextValuesToAdd: string[];
    public isLocalSetting: boolean;

    constructor(parent: AzExtParentTreeItem, clientProvider: AppSettingsClientProvider, public readonly extensionPrefix: string, options?: AppSettingsTreeItemOptions) {
        super(parent);
        this.clientProvider = clientProvider;
        this.supportsSlots = options?.supportsSlots ?? true;
        this._settingsToHide = options?.settingsToHide;
        this.contextValuesToAdd = options?.contextValuesToAdd || [];
        this.isLocalSetting = this.contextValuesToAdd.includes('localSettings');
        if (this.isLocalSetting) {
            this.label = vscode.l10n.t('Local Settings');
        }
    }

    static async createAppSettingsTreeItem(context: IActionContext, parent: AzExtParentTreeItem, clientProvider: AppSettingsClientProvider, extensionPrefix: string, options?: AppSettingsTreeItemOptions): Promise<AppSettingsTreeItem> {
        const ti: AppSettingsTreeItem = new AppSettingsTreeItem(parent, clientProvider, extensionPrefix, options);
        await ti.refreshImpl(context);
        return ti;
    }

    public get id(): string {
        return 'configuration';
    }

    public get contextValue(): string {
        return createContextValue([AppSettingsTreeItem.contextValue, ...this.contextValuesToAdd]);
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
        if (this._settings.properties && Object.keys(this._settings.properties).length === 0 && this.isLocalSetting) {
            return [new GenericTreeItem(this, {
                label: vscode.l10n.t('No local settings found'),
                iconPath: new ThemeIcon('info'),
                contextValue: 'noLocalSettings'
            })];
        }

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
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));
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
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));

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
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));
        const newKey: string = await context.ui.showInputBox({
            prompt: 'Enter new app setting name',
            stepName: 'appSettingName',
            validateInput: (v: string): string | undefined => validateAppSettingKey(settings, client, v)
        });

        const newValue: string = await context.ui.showInputBox({
            prompt: `Enter value for "${newKey}"`,
            stepName: 'appSettingValue',
            validateInput: (v: string): string | undefined => validateAppSettingValue(v)
        });

        if (!settings.properties) {
            settings.properties = {};
        }

        context.showCreatingTreeItem(newKey);
        settings.properties[newKey] = newValue;

        this._settings = await client.updateApplicationSettings(settings);

        return await AppSettingTreeItem.createAppSettingTreeItem(context, this, newKey, newValue);
    }

    public async ensureSettings(context: IActionContext): Promise<StringDictionary> {
        if (!this._settings) {
            await this.getCachedChildren(context);
        }

        return <StringDictionary>this._settings;
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        const client = await this.clientProvider.createClient(context);
        const appSettings = await client.listApplicationSettings();
        if (appSettings.properties) {
            for (const [key, value] of Object.entries(appSettings.properties)) {
                if (isSettingConnectionString(key, value)) {
                    this.contextValuesToAdd?.push('convert');
                }
            }
        }
    }
}
