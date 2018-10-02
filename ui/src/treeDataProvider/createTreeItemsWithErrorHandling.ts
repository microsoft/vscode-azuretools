/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { localize } from '../localize';
import { AzureParentTreeItem } from './AzureParentTreeItem';
import { AzureTreeItem } from './AzureTreeItem';

class InvalidTreeItem extends AzureParentTreeItem {
    public readonly contextValue: string;
    public readonly label: string;
    public readonly description: string;

    // tslint:disable-next-line:no-any
    private _error: any;

    // tslint:disable-next-line:no-any
    constructor(parent: AzureParentTreeItem, label: string, error: any, contextValue: string, description: string = localize('invalid', 'Invalid')) {
        super(parent);
        this.label = label;
        this._error = error;
        this.contextValue = contextValue;
        this.description = description;
    }

    public get iconPath(): string {
        return path.join(__filename, '..', '..', '..', '..', 'resources', 'warning.svg');
    }

    public async loadMoreChildrenImpl(): Promise<AzureTreeItem[]> {
        throw this._error;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public isAncestorOfImpl(): boolean {
        // never display invalid items in tree picker
        return false;
    }
}

export async function createTreeItemsWithErrorHandling<T>(
    treeItem: AzureParentTreeItem,
    sourceArray: T[],
    invalidContextValue: string,
    createTreeItem: (source: T) => AzureTreeItem | undefined | Promise<AzureTreeItem | undefined>,
    getLabelOnError: (source: T) => string | undefined | Promise<string | undefined>): Promise<AzureTreeItem[]> {

    const treeItems: AzureTreeItem[] = [];
    // tslint:disable-next-line:no-any
    let unknownError: any;
    await Promise.all(sourceArray.map(async (source: T) => {
        try {
            const item: AzureTreeItem | undefined = await createTreeItem(source);
            if (item) {
                treeItems.push(item);
            }
        } catch (error) {
            let name: string | undefined;
            try {
                name = await getLabelOnError(source);
            } catch {
                // ignore
            }

            if (name) {
                treeItems.push(new InvalidTreeItem(treeItem, name, error, invalidContextValue));
            } else if (error && !unknownError) {
                unknownError = error;
            }
        }
    }));

    if (unknownError) {
        // Display a generic error if there are any unknown items. Only the first error will be displayed
        const message: string = localize('cantShowItems', 'Some items could not be displayed');
        treeItems.push(new InvalidTreeItem(treeItem, message, unknownError, invalidContextValue, ''));
    }

    return treeItems;
}
