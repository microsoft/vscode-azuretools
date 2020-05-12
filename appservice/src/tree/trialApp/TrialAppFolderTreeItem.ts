/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem, IActionContext, parseError, TreeItemIconPath } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { localize } from '../../localize';
import { TrialAppClient } from '../../TrialAppClient';
import { getThemedIconPath } from '../IconPath';
import { TrialAppFileTreeItem } from './TrialAppFileTreeItem';
export class TrialAppFolderTreeItem extends AzExtParentTreeItem {

    public get iconPath(): TreeItemIconPath {
        return getThemedIconPath('folder');
    }

    public get description(): string | undefined {
        return this.isReadOnly ? 'Read-only' : '';
    }
    public static contextValue: string = 'folder';
    public readonly contextValue: string = TrialAppFolderTreeItem.contextValue;
    public readonly childTypeLabel: string = localize('fileOrFolder', 'file or folder');
    public readonly label: string;
    public readonly path: string;
    public readonly isReadOnly: boolean;
    public client: TrialAppClient;
    protected readonly _isRoot: boolean = false;

    constructor(parent: AzExtParentTreeItem, label: string, path: string, isReadOnly: boolean, client: TrialAppClient) {
        super(parent);
        this.label = label;
        this.path = path;
        this.isReadOnly = isReadOnly;
        this.client = client;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        const kuduClient: KuduClient = await this.client.getKuduClient();
        let response: IKuduItemResponse;
        try {
            response = <IKuduItemResponse><unknown>(await kuduClient.vfs.getItemWithHttpOperationResponse(this.path)).response;
        } catch (error) {
            // Linux Consumption doesn't seem to support logs/files, but hopefully it does eventually
            // https://github.com/microsoft/vscode-azurefunctions/issues/1599
            if (this._isRoot && parseError(error).errorType === '404') {
                throw new Error(localize('notSupported', 'This plan does not support viewing files.'));
            } else {
                throw error;
            }
        }

        let files: IKuduFile[] = <IKuduFile[]>JSON.parse(response.body);
        // this file is being accessed by Kudu and is not viewable
        files = files.filter(f => f.mime !== 'text/xml' || !f.name.includes('LogFiles-kudu-trace_pending.xml'));

        return files.map((file: IKuduFile) => {
            const home: string = 'home';
            // truncate the home of the path
            // the substring starts at file.path.indexOf(home) because the path sometimes includes site/ or D:\
            // the home.length + 1 is to account for the trailing slash, Linux uses / and Window uses \
            const fsPath: string = file.path.substring(file.path.indexOf(home) + home.length + 1);
            return file.mime === 'inode/directory' ? new TrialAppFolderTreeItem(this, file.name, fsPath, this.isReadOnly, this.client) : new TrialAppFileTreeItem(this, file.name, fsPath, this.isReadOnly, this.client);
        });
    }

    public compareChildrenImpl(ti1: AzExtTreeItem, ti2: AzExtTreeItem): number {
        let result: number | undefined = instanceOfCompare(ti1, ti2, GenericTreeItem);

        if (result === undefined) {
            result = instanceOfCompare(ti1, ti2, TrialAppFolderTreeItem);
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

interface IKuduFile {
    mime: string;
    name: string;
    path: string;
}

interface IKuduItemResponse {
    body: string;
}
