/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureTreeDataProvider, IAzureParentTreeItem } from "../../index";
import { AzureParentNode } from "./AzureParentNode";

export class RootNode extends AzureParentNode {
    private readonly _treeDataProvider: AzureTreeDataProvider;

    public constructor(treeDataProvider: AzureTreeDataProvider, treeItem: IAzureParentTreeItem) {
        super(undefined, treeItem);
        this._treeDataProvider = treeDataProvider;
    }

    public get treeDataProvider(): AzureTreeDataProvider {
        return this._treeDataProvider;
    }
}
