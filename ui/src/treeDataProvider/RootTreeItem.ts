/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../..';
import { AzExtParentTreeItem } from './AzExtParentTreeItem';
import { IAzExtTreeDataProviderInternal } from './InternalInterfaces';

export abstract class RootTreeItem<T> extends AzExtParentTreeItem<T> implements types.RootTreeItem<T> {
    private readonly _root: T;
    private _treeDataProvider: IAzExtTreeDataProviderInternal<T>;

    public constructor(root: T) {
        super(undefined);
        this._root = root;
    }

    public get treeDataProvider(): IAzExtTreeDataProviderInternal<T> {
        return this._treeDataProvider;
    }

    public set treeDataProvider(treeDataProvider: IAzExtTreeDataProviderInternal<T>) {
        this._treeDataProvider = treeDataProvider;
    }

    public get root(): T {
        return this._root;
    }
}
