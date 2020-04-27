/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { AzureParentTreeItem, AzureTreeItem, IActionContext, IContextValue, IExpectedContextValue, ITreeItemWizardContext, IWizardOptions, TreeItemIconPath } from 'vscode-azureextensionui';
import { SiteClient } from "../SiteClient";
import { AppSettingTreeItem } from './AppSettingTreeItem';
import { AppSettingCreateStep } from './AppSettingWizard/AppSettingCreateStep';
import { AppSettingKeyStep } from './AppSettingWizard/AppSettingKeyStep';
import { AppSettingValueStep } from './AppSettingWizard/AppSettingValueStep';
import { getThemedIconPath } from './IconPath';
import { ISiteTreeRoot } from './ISiteTreeRoot';

export function validateAppSettingKey(settings: StringDictionary, client: SiteClient, newKey?: string, oldKey?: string): string | undefined {
    newKey = newKey ? newKey : '';

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
                return `Setting "${newKey}" already exists.`;
            }
        }
    }

    return undefined;
}

export class AppSettingsTreeItem extends AzureParentTreeItem<ISiteTreeRoot> {
    public static contextValueId: string = 'appSettings';
    public readonly label: string = 'Application Settings';
    public readonly childTypeLabel: string = 'App Setting';
    private _settings: StringDictionary | undefined;

    public get id(): string {
        return 'configuration';
    }

    public get contextValue(): IContextValue {
        return { id: AppSettingsTreeItem.contextValueId };
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('settings');
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<ISiteTreeRoot>[]> {
        this._settings = await this.root.client.listApplicationSettings();
        const treeItems: AppSettingTreeItem[] = [];
        // tslint:disable-next-line:strict-boolean-expressions
        const properties: { [name: string]: string } = this._settings.properties || {};
        await Promise.all(Object.keys(properties).map(async (key: string) => {
            const appSettingTreeItem: AppSettingTreeItem = await AppSettingTreeItem.createAppSettingTreeItem(this, key, properties[key]);
            treeItems.push(appSettingTreeItem);
        }));

        return treeItems;
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

        this._settings = await this.root.client.updateApplicationSettings(settings);
    }

    public async deleteSettingItem(key: string, context: IActionContext): Promise<void> {
        // make a deep copy so settings are not cached if there's a failure
        // tslint:disable-next-line: no-unsafe-any
        const settings: StringDictionary = JSON.parse(JSON.stringify(await this.ensureSettings(context)));

        if (settings.properties) {
            delete settings.properties[key];
        }

        this._settings = await this.root.client.updateApplicationSettings(settings);
    }

    public async postTreeItemListStep(context: ITreeItemWizardContext): Promise<void> {
        Object.assign(context, {
            appSettingsTreeItem: this,
            appSettings: await this.ensureSettings(context)
        });
    }

    public async getCreateSubWizardImpl(_context: ITreeItemWizardContext): Promise<IWizardOptions<IActionContext>> {
        return {
            promptSteps: [new AppSettingKeyStep(), new AppSettingValueStep()],
            executeSteps: [new AppSettingCreateStep()]
        };
    }

    public async ensureSettings(context: IActionContext): Promise<StringDictionary> {
        if (!this._settings) {
            await this.getCachedChildren(context);
        }

        return <StringDictionary>this._settings;
    }

    public isAncestorOfImpl(expectedContextValue: IExpectedContextValue): boolean {
        return expectedContextValue.id === AppSettingTreeItem.contextValueId;
    }
}
