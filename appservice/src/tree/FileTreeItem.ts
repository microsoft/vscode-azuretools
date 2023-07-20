/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, createContextValue, IActionContext, openReadOnlyContent, TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import { l10n, ThemeIcon } from 'vscode';
import { ext } from '../extensionVariables';
import { ParsedSite } from '../SiteClient';
import { getFile, ISiteFile } from '../siteFiles';
import { FolderTreeItem } from './FolderTreeItem';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.openFile'` that should be registered by each extension
 */
export class FileTreeItem extends AzExtTreeItem {
    public static contextValue: string = 'file';
    public readonly label: string;
    public readonly url: string;
    public readonly isReadOnly: boolean;
    public readonly site: ParsedSite;
    public readonly parent: FolderTreeItem;

    constructor(parent: FolderTreeItem, site: ParsedSite, label: string, url: string, isReadOnly: boolean) {
        super(parent);
        this.site = site;
        this.label = label;
        this.url = url;
        this.isReadOnly = isReadOnly;
    }

    public get contextValue(): string {
        return createContextValue([FileTreeItem.contextValue, ...this.parent.contextValuesToAdd])
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('file');
    }

    public get commandId(): string {
        return ext.prefix + '.openFile';
    }

    public async openReadOnly(context: IActionContext): Promise<void> {
        await this.runWithTemporaryDescription(context, l10n.t('Opening...'), async () => {
            const file: ISiteFile = await getFile(context, this.site, this.url);
            await openReadOnlyContent(this, file.data, '');
        });
    }
}
