/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { AzExtParentTreeItem, AzExtTreeItem, IActionContext, ICreateChildImplContext, TreeItemIconPath } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { TrialAppSettingTreeItem, validateAppSettingKey } from '../..';
import { ext } from '../../extensionVariables';
import { TrialAppClient } from '../../TrialAppClient';
import { getThemedIconPath } from '../IconPath';

export class TrialAppSettingsTreeItem extends AzExtParentTreeItem {

    public get id(): string {
        return 'configuration';
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('settings');
    }
    public static contextValue: string = 'applicationSettings';
    public readonly label: string = 'Application Settings';
    public readonly childTypeLabel: string = 'App Setting';
    public readonly contextValue: string = TrialAppSettingsTreeItem.contextValue;
    public client: TrialAppClient;

    private _settings: StringDictionary | undefined;

    public constructor(parent: AzExtParentTreeItem, client: TrialAppClient) {
        super(parent);
        this.client = client;
        // tslint:disable-next-line: no-unused-expression
        parent.commandId;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        const kuduClient: KuduClient = await this.client.getKuduClient();
        const settings: StringDictionary = <StringDictionary>await kuduClient.settings.getAll();
        this._settings = settings;

        const treeItems: TrialAppSettingTreeItem[] = [];
        // tslint:disable-next-line: no-unsafe-any
        // tslint:disable-next-line:strict-boolean-expressions
        // tslint:disable
        Object.keys(settings).forEach(async (setting: string) => {
            const appSettingTreeItem: TrialAppSettingTreeItem = await TrialAppSettingTreeItem.createAppSettingTreeItem(this, setting, settings[setting]);
            treeItems.push(appSettingTreeItem);
        });

        return treeItems;
    }

    public async editSettingItem(oldKey: string, newKey: string, value: string, context: IActionContext): Promise<void> {
        // make a deep copy so settings are not cached if there's a failure
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));

        const isRename: boolean = oldKey !== newKey;

        if (settings) {
            if (isRename) {
                delete settings[oldKey];
            }
            settings[newKey] = value;
        }

        this._settings = isRename ?
            await this.client.renameApplicationSetting(settings, oldKey, newKey) :
            await this.client.updateApplicationSetting(settings, newKey);
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<TrialAppSettingTreeItem> {
        // make a deep copy so settings are not cached if there's a failure
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));
        const newKey: string = await ext.ui.showInputBox({
            prompt: 'Enter new setting key',
            validateInput: (v?: string): string | undefined => validateAppSettingKey(settings, this.client, v)
        });

        const newValue: string = await ext.ui.showInputBox({
            prompt: `Enter setting value for "${newKey}"`
        });

        if (!settings.properties) {
            settings.properties = {};
        }

        context.showCreatingTreeItem(newKey);
        settings.properties[newKey] = newValue;

        this._settings = await this.client.updateApplicationSetting(settings, newKey);

        return await TrialAppSettingTreeItem.createAppSettingTreeItem(this, newKey, newValue);
    }

    public async deleteSettingItem(key: string, context: IActionContext): Promise<void> {
        // make a deep copy so settings are not cached if there's a failure
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));

        if (settings.properties) {
            delete settings.properties[key];
        }

        this._settings = await this.client.deleteApplicationSetting(settings, key);
    }

    public async ensureSettings(context: IActionContext): Promise<StringDictionary> {
        if (!this._settings) {
            await this.getCachedChildren(context);
        }

        return <StringDictionary>this._settings;
    }
}
