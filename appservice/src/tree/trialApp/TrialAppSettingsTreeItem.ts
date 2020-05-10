/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import { AzExtParentTreeItem, AzExtTreeItem, TreeItemIconPath } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { TrialAppSettingTreeItem } from '../..';
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

    private _client: KuduClient;

    public constructor(parent: AzExtParentTreeItem, kuduClient: KuduClient) {
        super(parent);
        this._client = kuduClient;
        // tslint:disable-next-line: no-unused-expression
        parent.commandId;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        const settings: StringDictionary = <StringDictionary>await this._client.settings.getAll();

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
}
