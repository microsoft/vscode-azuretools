/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { createGenericElement } from './createGenericElement';
import * as types from '../../../index';
import { localize } from '../../localize';

export class TreeElementStateManager<TElement extends types.TreeElementWithId = types.TreeElementWithId> implements vscode.Disposable {
    private readonly store: Record<string, types.TreeElementStateModel | undefined> = {};
    private readonly disposables: vscode.Disposable[] = [];
    private readonly onDidUpdateStateEmitter = new vscode.EventEmitter<string>();
    private readonly onDidUpdateStateEvent: vscode.Event<string> = this.onDidUpdateStateEmitter.event;

    async runWithTemporaryDescription<T = void>(id: string, description: string, callback: () => Promise<T>, dontRefreshOnRemove?: boolean): Promise<T> {
        let result: T;
        this.update(id, { ...this.getState(id), temporaryDescription: description, spinner: true });
        try {
            result = await callback();
        } finally {
            this.update(id, { ...this.getState(id), temporaryDescription: undefined, spinner: false }, dontRefreshOnRemove);
        }
        return result;
    }

    async showDeleting(id: string, callback: () => Promise<void>): Promise<void> {
        await this.runWithTemporaryDescription(id, localize('deleting', 'Deleting...'), callback, true);
    }

    async showCreatingChild<T = void>(id: string, label: string, callback: () => Promise<T>): Promise<T> {
        return await this.runWithTemporaryChild(id, createGenericElement({
            iconPath: new vscode.ThemeIcon('loading~spin'),
            label,
            contextValue: 'creatingChild',
        }), async () => {
            return await callback();
        });
    }

    notifyChildrenChanged(id: string): void {
        this.onDidUpdateStateEmitter.fire(id);
    }

    wrapItemInStateHandling(item: TElement, refresh: (item: TElement) => void): TElement {
        const getTreeItem = item.getTreeItem.bind(item) as typeof item.getTreeItem;
        item.getTreeItem = async () => {
            const treeItem = await getTreeItem();
            if (item.id) {
                return this.applyToTreeItem({ ...treeItem, id: item.id });
            }
            return treeItem;
        }

        if (item.getChildren) {
            const getChildren = item.getChildren.bind(item) as typeof item.getChildren;
            item.getChildren = async () => {
                const children = await getChildren() ?? [];
                const state = this.getState(item.id);
                if (state.temporaryChildren) {
                    children.unshift(...state.temporaryChildren);
                }

                return children;
            }
        }

        this.onDidRequestRefresh(item.id, () => refresh(item));

        return item;
    }

    dispose(): void {
        this.disposables.forEach((disposable) => {
            disposable.dispose();
        });
    }

    private async runWithTemporaryChild<T = void>(id: string, child: types.TreeElementBase, callback: () => Promise<T>): Promise<T> {
        this.update(id, {
            ...this.getState(id),
            temporaryChildren: [child, ...(this.getState(id).temporaryChildren ?? [])],
        });

        let result: T;
        try {
            result = await callback();
        } finally {
            this.update(id, {
                ...this.getState(id),
                temporaryChildren: this.getState(id).temporaryChildren?.filter(element => element !== child),
            });
        }
        return result;
    }

    private applyStateToTreeItem(state: Partial<types.TreeElementStateModel>, treeItem: vscode.TreeItem): vscode.TreeItem {

        if (state.temporaryDescription) {
            treeItem.description = state.temporaryDescription;
        }

        if (state.spinner) {
            treeItem.iconPath = new vscode.ThemeIcon('loading~spin');
        }

        return treeItem;
    }

    private onDidRequestRefresh(id: string, callback: () => void): void {
        this.disposables.push(this.onDidUpdateStateEvent((eventId: string) => {
            if (eventId === id) {
                callback();
            }
        }));
    }

    private applyToTreeItem(treeItem: vscode.TreeItem & { id: string }): vscode.TreeItem {
        const state = this.getState(treeItem.id);
        return this.applyStateToTreeItem(state, { ...treeItem });
    }

    private getState(id: string): Partial<types.TreeElementStateModel> {
        return this.store[id] ?? {};
    }

    /**
     * @param suppressRefresh If true, an onDidUpdateStateEvent will not be fired.
     */
    private update(id: string, state: Partial<types.TreeElementStateModel>, suppressRefresh?: boolean): void {
        this.store[id] = { ...this.getState(id), ...state };
        if (!suppressRefresh) {
            this.onDidUpdateStateEmitter.fire(id);
        }
    }
}
