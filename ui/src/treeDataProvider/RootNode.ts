/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'vscode';
import { AzureTreeDataProvider, IAzureNode, IAzureParentTreeItem, IAzureUserInput } from "../../index";
import { AzureParentNode } from "./AzureParentNode";

export class RootNode extends AzureParentNode {
    private readonly _treeDataProvider: AzureTreeDataProvider;
    private readonly _ui: IAzureUserInput;

    public constructor(treeDataProvider: AzureTreeDataProvider, ui: IAzureUserInput, treeItem: IAzureParentTreeItem, onNodeCreateEmitter: EventEmitter<IAzureNode>) {
        super(undefined, treeItem, onNodeCreateEmitter);
        this._treeDataProvider = treeDataProvider;
        this._ui = ui;
    }

    public get treeDataProvider(): AzureTreeDataProvider {
        return this._treeDataProvider;
    }

    public get ui(): IAzureUserInput {
        return this._ui;
    }
}
