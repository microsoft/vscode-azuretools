/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ThemeIcon } from 'vscode';
import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem, IActionContext, TreeItemIconPath } from 'vscode-azureextensionui';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { ISiteFileMetadata, listFiles } from '../siteFiles';
import { FileTreeItem } from './FileTreeItem';

export class FolderTreeItem extends AzExtParentTreeItem {
    public static contextValue: string = 'folder';
    public readonly contextValue: string = FolderTreeItem.contextValue;
    public readonly childTypeLabel: string = localize('fileOrFolder', 'file or folder');
    public readonly label: string;
    public readonly path: string;
    public readonly isReadOnly: boolean;

    public readonly client: SiteClient;
    protected readonly _isRoot: boolean = false;

    constructor(parent: AzExtParentTreeItem, client: SiteClient, label: string, path: string, isReadOnly: boolean) {
        super(parent);
        this.client = client;
        this.label = label;
        this.path = path;
        this.isReadOnly = isReadOnly;
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('folder');
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public get description(): string | undefined {
        return this._isRoot && this.isReadOnly ? localize('readOnly', 'Read-only') : undefined;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        let files: ISiteFileMetadata[] = await listFiles(context, this.client, this.path);

        // this file is being accessed by Kudu and is not viewable
        files = files.filter(f => f.mime !== 'text/xml' || !f.name.includes('LogFiles-kudu-trace_pending.xml'));

        return files.map(file => {
            const home: string = 'home';
            // truncate the home of the path
            // the substring starts at file.path.indexOf(home) because the path sometimes includes site/ or D:\
            // the home.length + 1 is to account for the trailing slash, Linux uses / and Window uses \
            const fsPath: string = file.path.substring(file.path.indexOf(home) + home.length + 1);
            return file.mime === 'inode/directory' ? new FolderTreeItem(this, this.client, file.name, fsPath, this.isReadOnly) : new FileTreeItem(this, this.client, file.name, fsPath, this.isReadOnly);
        });
    }

    public compareChildrenImpl(ti1: AzExtTreeItem, ti2: AzExtTreeItem): number {
        let result: number | undefined = instanceOfCompare(ti1, ti2, GenericTreeItem);

        if (result === undefined) {
            result = instanceOfCompare(ti1, ti2, FolderTreeItem);
        }

        return result === undefined ? ti1.label.localeCompare(ti2.label) : result;
    }
}

function instanceOfCompare<T>(ti1: AzExtTreeItem, ti2: AzExtTreeItem, typeToCompare: new (...args: unknown[]) => T): number | undefined {
    if (!(ti1 instanceof typeToCompare) && ti2 instanceof typeToCompare) {
        return 1;
    } else if (ti1 instanceof typeToCompare && !(ti2 instanceof typeToCompare)) {
        return -1;
    } else {
        return undefined;
    }
}
