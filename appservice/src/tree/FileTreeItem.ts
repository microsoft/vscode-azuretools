/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, openReadOnlyContent, TreeItemIconPath } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { ISimplifiedSiteClient } from '../ISimplifiedSiteClient';
import { localize } from '../localize';
import { getFile, ISiteFile } from '../siteFiles';
import { getThemedIconPath } from './IconPath';

/**
 * NOTE: This leverages a command with id `ext.prefix + '.openFile'` that should be registered by each extension
 */
export class FileTreeItem extends AzExtTreeItem {
    public static contextValue: string = 'file';
    public readonly contextValue: string = FileTreeItem.contextValue;
    public readonly label: string;
    public readonly path: string;
    public readonly isReadOnly: boolean;

    public readonly client: ISimplifiedSiteClient;

    constructor(parent: AzExtParentTreeItem, client: ISimplifiedSiteClient, label: string, path: string, isReadOnly: boolean) {
        super(parent);
        this.client = client;
        this.label = label;
        this.path = path;
        this.isReadOnly = isReadOnly;
    }

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('file');
    }

    public get commandId(): string {
        return ext.prefix + '.openFile';
    }

    public async openReadOnly(): Promise<void> {
        await this.runWithTemporaryDescription(localize('opening', 'Opening...'), async () => {
            const file: ISiteFile = await getFile(this.client, this.path);
            await openReadOnlyContent(this, file.data, '');
        });
    }
}
