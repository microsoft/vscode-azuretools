/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { AzExtTreeItem, openReadOnlyContent } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { IFileResult } from '../..';
import { ext } from '../../extensionVariables';
import { localize } from '../../localize';
import { TrialAppFolderTreeItem } from './TrialAppFolderTreeItem';
/**
 * NOTE: This leverages a command with id `ext.prefix + '.openFile'` that should be registered by each extension
 */
export class TrialAppFileTreeItem extends AzExtTreeItem {

    public get commandId(): string {
        return ext.prefix + '.openFile';
    }
    public static contextValue: string = 'file';
    public readonly contextValue: string = TrialAppFileTreeItem.contextValue;
    public readonly label: string;
    public readonly path: string;
    public readonly isReadOnly: boolean;
    public kuduClient: KuduClient;

    // @ts-ignore
    constructor(parent: TrialAppFolderTreeItem, label: string, path: string, isReadOnly: boolean, kuduClient: KuduClient) {
        super(parent);
        this.label = label;
        this.path = path;
        this.isReadOnly = isReadOnly;
        this.kuduClient = kuduClient;
        let ti: TreeItem = new TreeItem(this.label, TreeItemCollapsibleState.None);
        ti.resourceUri = Uri.file(this.path);
        this.iconPath = ti.iconPath;
    }

    public async openReadOnly(): Promise<void> {
        await this.runWithTemporaryDescription(localize('opening', 'Opening...'), async () => {
            // tslint:disable:no-unsafe-any
            // tslint:disable-next-line:no-any
            const response: any = (<any>await this.kuduClient.vfs.getItemWithHttpOperationResponse(this.path)).response;
            if (response && response.headers && response.headers.etag) {
                const result: IFileResult = { data: response.body, etag: response.headers.etag };
                await openReadOnlyContent(this, result.data, '');
            }
        });
    }
}
