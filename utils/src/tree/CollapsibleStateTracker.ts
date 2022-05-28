/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, EventEmitter, TreeItemCollapsibleState, TreeView } from "vscode";
import * as types from "../../index";
import { AzExtTreeItem } from "./AzExtTreeItem";

export class CollapsibleStateTracker implements Disposable {
    private readonly disposables: Disposable[] = [];
    private readonly collapsibleStateCache = new Map<string, TreeItemCollapsibleState | undefined>();

    public readonly onDidExpandOrRefreshExpandedEmitter = new EventEmitter<types.OnDidExpandOrRefreshExpandedEmitterData>();

    public constructor(private readonly treeView: TreeView<AzExtTreeItem>) {
        this.disposables.push(
            this.treeView.onDidCollapseElement(evt => {
                this.collapsibleStateCache.set(evt.element.effectiveId, TreeItemCollapsibleState.Collapsed);
            })
        );

        this.disposables.push(
            this.treeView.onDidExpandElement(evt => {
                this.collapsibleStateCache.set(evt.element.effectiveId, TreeItemCollapsibleState.Expanded);
                this.onDidExpandOrRefreshExpandedEmitter.fire({ item: evt.element, source: 'expand' });
            })
        );
    }

    public dispose(): void {
        this.disposables.forEach(disposable => void disposable.dispose());
    }

    public getCollapsibleState(treeItem: AzExtTreeItem): TreeItemCollapsibleState | undefined {
        if (!this.collapsibleStateCache.has(treeItem.effectiveId)) {
            // If the cache doesn't contain it, that means it has never been interacted with by the user, and will have its initial state
            const result: TreeItemCollapsibleState | undefined =
                treeItem.parent === undefined ?
                    TreeItemCollapsibleState.Expanded : // The root node is always expanded
                    treeItem.initialCollapsibleState;   // Other nodes will have their initial state as the collapsible state

            this.collapsibleStateCache.set(treeItem.effectiveId, result);
        }

        return this.collapsibleStateCache.get(treeItem.effectiveId);
    }
}
