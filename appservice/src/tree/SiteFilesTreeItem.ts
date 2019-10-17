/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureParentTreeItem } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { FolderTreeItem } from './FolderTreeItem';

export class SiteFilesTreeItem extends FolderTreeItem {
    public static contextValue: string = 'siteFiles';
    public readonly contextValue: string = SiteFilesTreeItem.contextValue;

    protected readonly _isRoot: boolean = true;

    constructor(parent: AzureParentTreeItem, isReadOnly: boolean) {
        super(parent, localize('siteFiles', 'Files'), '/site/wwwroot', isReadOnly);
    }
}
