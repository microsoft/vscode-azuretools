/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem } from '@microsoft/vscode-azext-utils';
import { localize } from '../localize';
import { ParsedSite } from '../SiteClient';
import { FolderTreeItem } from './FolderTreeItem';

export class SiteFilesTreeItem extends FolderTreeItem {
    public static contextValue: string = 'siteFiles';
    public readonly contextValue: string = SiteFilesTreeItem.contextValue;
    public suppressMaskLabel: boolean = true;

    protected readonly _isRoot: boolean = true;

    constructor(parent: AzExtParentTreeItem, site: ParsedSite, isReadOnly: boolean) {
        super(parent, site, localize('siteFiles', 'Files'), '/site/wwwroot', isReadOnly);
    }
}
