/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { AzExtParentTreeItem, IActionContext, TreeItemIconPath } from 'vscode-azureextensionui';
import { IAppSettingsClient } from '../IAppSettingsClient';
import { getThemedIconPath } from './IconPath';

export abstract class AppSettingsTreeItemBase extends AzExtParentTreeItem {

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('settings');
    }

    public get id(): string {
        return 'configuration';
    }
    public static contextValue: string = 'applicationSettings';
    public readonly label: string = 'Application Settings';
    public readonly childTypeLabel: string = 'App Setting';
    public readonly contextValue: string = AppSettingsTreeItemBase.contextValue;

    public readonly _client: IAppSettingsClient;

    protected _settings: StringDictionary | undefined;

    constructor(parent: AzExtParentTreeItem, client: IAppSettingsClient) {
        super(parent);
        this._client = client;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async editSettingItem(oldKey: string, newKey: string, value: string, context: IActionContext): Promise<void> {
        // make a deep copy so settings are not cached if there's a failure
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));
        if (settings.properties) {
            if (oldKey !== newKey) {
                delete settings.properties[oldKey];
            }
            settings.properties[newKey] = value;
        }

        this._settings = await this._client.updateApplicationSettings(settings);
    }

    public async deleteSettingItem(key: string, context: IActionContext): Promise<void> {
        // make a deep copy so settings are not cached if there's a failure
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));

        if (settings.properties) {
            delete settings.properties[key];
        }

        this._settings = await this._client.updateApplicationSettings(settings);
    }

    public async ensureSettings(context: IActionContext): Promise<StringDictionary> {
        if (!this._settings) {
            await this.getCachedChildren(context);
        }

        return <StringDictionary>this._settings;
    }
}
