/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ThemeIcon } from 'vscode';
import { AzExtParentTreeItem, AzExtTreeItem, IActionContext, openReadOnlyContent, TreeItemIconPath } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ParsedSite } from '../SiteClient';
import { getFile, ISiteFile } from '../siteFiles';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.openFile'` that should be registered by each extension
 */
export class FileTreeItem extends AzExtTreeItem {
    public static contextValue: string = 'file';
    public readonly contextValue: string = FileTreeItem.contextValue;
    public readonly label: string;
    public readonly path: string;
    public readonly isReadOnly: boolean;

    public readonly site: ParsedSite;

    constructor(parent: AzExtParentTreeItem, site: ParsedSite, label: string, path: string, isReadOnly: boolean) {
        super(parent);
        this.site = site;
        this.label = label;
        this.path = path;
        this.isReadOnly = isReadOnly;
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('file');
    }

    public get commandId(): string {
        return ext.prefix + '.openFile';
    }

    public async openReadOnly(context: IActionContext): Promise<void> {
        await this.runWithTemporaryDescription(context, localize('opening', 'Opening...'), async () => {
            const file: ISiteFile = await getFile(context, this.site, this.path);
            await openReadOnlyContent(this, file.data, '');
        });
    }
}
