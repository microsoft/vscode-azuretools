/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as path from 'path';
import { MessageItem } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { AppSettingTreeItem } from './AppSettingTreeItem';
import { ISiteTreeRoot } from './ISiteTreeRoot';

export function validateAppSettingKey(settings: StringDictionary, newKey?: string, oldKey?: string): string | undefined {
    newKey = newKey ? newKey.trim() : '';
    oldKey = oldKey ? oldKey.trim().toLowerCase() : oldKey;
    if (newKey.length === 0) {
        return 'Key must have at least one non-whitespace character.';
    }
    if (settings.properties && newKey.toLowerCase() !== oldKey) {
        for (const key of Object.keys(settings.properties)) {
            if (key.toLowerCase() === newKey.toLowerCase()) {
                return `Setting "${newKey}" already exists.`;
            }
        }
    }

    return undefined;
}

export class AppSettingsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValue: string = 'applicationSettings';
    public readonly label: string = 'Application Settings';
    public readonly childTypeLabel: string = 'App Setting';
    public readonly contextValue: string = AppSettingsTreeItem.contextValue;
    private _settings: StringDictionary | undefined;
    private _commandId: string;

    constructor(parent: AzureParentTreeItem, commandId: string) {
        super(parent);
        this._commandId = commandId;
    }

    public get id(): string {
        return 'application';
    }

    public get iconPath(): { light: string, dark: string } {
        return {
            light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'AppSettings_color.svg'),
            dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'AppSettings_color.svg')
        };
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        this._settings = await this.root.client.listApplicationSettings();
        const treeItems: AppSettingTreeItem[] = [];
        // tslint:disable-next-line:strict-boolean-expressions
        const properties: { [name: string]: string } = this._settings.properties || {};
        Object.keys(properties).forEach((key: string) => {
            treeItems.push(new AppSettingTreeItem(this, key, properties[key], this._commandId));
        });

        return treeItems;
    }

    public async editSettingItem(oldKey: string, newKey: string, value: string): Promise<void> {
        const settings: StringDictionary = await this.ensureSettings();

        if (settings.properties) {
            if (oldKey !== newKey) {
                delete settings.properties[oldKey];
            }
            settings.properties[newKey] = value;
        }

        await this.root.client.updateApplicationSettings(settings);
    }

    public async deleteSettingItem(key: string): Promise<void> {
        const settings: StringDictionary = await this.ensureSettings();

        if (settings.properties) {
            delete settings.properties[key];
        }

        await this.root.client.updateApplicationSettings(settings);
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem<ISiteTreeRoot>> {
        const settings: StringDictionary = await this.ensureSettings();

        const newKey: string = await ext.ui.showInputBox({
            prompt: 'Enter new setting key',
            validateInput: (v?: string): string | undefined => validateAppSettingKey(settings, v)
        });

        const newValue: string = await ext.ui.showInputBox({
            prompt: `Enter setting value for "${newKey}"`
        });

        if (!settings.properties) {
            settings.properties = {};
        }

        showCreatingTreeItem(newKey);
        settings.properties[newKey] = newValue;
        await this.root.client.updateApplicationSettings(settings);
        return new AppSettingTreeItem(this, newKey, newValue, this._commandId);
    }

    public async ensureSettings(): Promise<StringDictionary> {
        if (!this._settings) {
            await this.getCachedChildren();
        }

        return <StringDictionary>this._settings;
    }

    public async confirmOverwriteSettings(sourceSettings: { [key: string]: string }, destinationSettings: { [key: string]: string }, destinationName: string): Promise<void> {
        function logKey(key: string): void {
            ext.outputChannel.appendLine(`- ${key}`);
        }
        let suppressPrompt: boolean = false;
        let overwriteSetting: boolean = false;

        const addedKeys: string[] = [];
        const updatedKeys: string[] = [];
        const userIgnoredKeys: string[] = [];
        const matchingKeys: string[] = [];

        for (const key of Object.keys(sourceSettings)) {
            if (destinationSettings[key] === undefined) {
                addedKeys.push(key);
                destinationSettings[key] = sourceSettings[key];
            } else if (destinationSettings[key] !== sourceSettings[key]) {
                if (!suppressPrompt) {
                    const yesToAll: MessageItem = { title: 'Yes to all' };
                    const noToAll: MessageItem = { title: 'No to all' };
                    const message: string = `Setting "${key}" already exists in "${destinationName}". Overwrite?`;
                    const result: MessageItem = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.yes, yesToAll, DialogResponses.no, noToAll);
                    if (result === DialogResponses.yes) {
                        overwriteSetting = true;
                    } else if (result === yesToAll) {
                        overwriteSetting = true;
                        suppressPrompt = true;
                    } else if (result === DialogResponses.no) {
                        overwriteSetting = false;
                    } else if (result === noToAll) {
                        overwriteSetting = false;
                        suppressPrompt = true;
                    }
                }

                if (overwriteSetting) {
                    updatedKeys.push(key);
                    destinationSettings[key] = sourceSettings[key];
                } else {
                    userIgnoredKeys.push(key);
                }
            } else {
                matchingKeys.push(key);
            }
        }

        if (addedKeys.length > 0) {
            ext.outputChannel.appendLine('Added the following settings:');
            addedKeys.forEach(logKey);
        }

        if (updatedKeys.length > 0) {
            ext.outputChannel.appendLine('Updated the following settings:');
            updatedKeys.forEach(logKey);
        }

        if (matchingKeys.length > 0) {
            ext.outputChannel.appendLine('Ignored the following settings that were already the same:');
            matchingKeys.forEach(logKey);
        }

        if (userIgnoredKeys.length > 0) {
            ext.outputChannel.appendLine('Ignored the following settings based on user input:');
            userIgnoredKeys.forEach(logKey);
        }

        if (Object.keys(destinationSettings).length > Object.keys(sourceSettings).length) {
            ext.outputChannel.appendLine(`WARNING: This operation will not delete any settings in "${destinationName}". You must manually delete settings if desired.`);
        }
    }
}
