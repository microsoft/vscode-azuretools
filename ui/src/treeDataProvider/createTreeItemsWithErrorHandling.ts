/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { IAzureParentTreeItem, IAzureTreeItem } from '../../index';
import { localize } from '../localize';

class InvalidTreeItem implements IAzureParentTreeItem {
    public readonly contextValue: string;
    public readonly label: string;
    public readonly description: string;

    // tslint:disable-next-line:no-any
    private _error: any;

    // tslint:disable-next-line:no-any
    constructor(label: string, error: any, contextValue: string, description: string = localize('invalid', 'Invalid')) {
        this.label = label;
        this._error = error;
        this.contextValue = contextValue;
        this.description = description;
    }

    public get iconPath(): string {
        return path.join(__filename, '..', '..', '..', '..', 'resources', 'warning.svg');
    }

    public async loadMoreChildren(): Promise<IAzureTreeItem[]> {
        throw this._error;
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public isAncestorOf(): boolean {
        // never display invalid nodes in node picker
        return false;
    }
}

export async function createTreeItemsWithErrorHandling<T>(
    sourceArray: T[],
    invalidContextValue: string,
    createTreeItem: (source: T) => IAzureTreeItem | undefined | Promise<IAzureTreeItem | undefined>,
    getLabelOnError: (source: T) => string | undefined | Promise<string | undefined>): Promise<IAzureTreeItem[]> {

    const treeItems: IAzureTreeItem[] = [];
    // tslint:disable-next-line:no-any
    let unknownError: any;
    await Promise.all(sourceArray.map(async (source: T) => {
        try {
            const item: IAzureTreeItem | undefined = await createTreeItem(source);
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
                treeItems.push(new InvalidTreeItem(name, error, invalidContextValue));
            } else if (error && !unknownError) {
                unknownError = error;
            }
        }
    }));

    if (unknownError) {
        // Display a generic error node if there are any unknown items. Only the first error will be displayed
        const message: string = localize('cantShowItems', 'Some items could not be displayed');
        treeItems.push(new InvalidTreeItem(message, unknownError, invalidContextValue, ''));
    }

    return treeItems;
}
