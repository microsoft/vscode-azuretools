/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from 'vscode';
import * as types from '../../index';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath } from './IconPath';
import { IAzExtParentTreeItemInternal, IAzExtTreeDataProviderInternal, isAzExtParentTreeItem } from "./InternalInterfaces";

export abstract class AzExtTreeItem implements types.AzExtTreeItem {
    //#region Properties implemented by base class
    public abstract label: string;
    public abstract contextValue: types.IContextValue;
    public description?: string;
    public id?: string;
    public commandId?: string;
    public commandArgs?: unknown[];
    public iconPath?: types.TreeItemIconPath;
    //#endregion

    public readonly collapsibleState: TreeItemCollapsibleState | undefined;
    public readonly parent: IAzExtParentTreeItemInternal | undefined;
    public _isLoadingMore: boolean;
    private _temporaryDescription?: string;
    private _treeDataProvider: IAzExtTreeDataProviderInternal | undefined;

    public constructor(parent: IAzExtParentTreeItemInternal | undefined) {
        this.parent = parent;
    }

    public get effectiveContextValue(): string {
        let result: string = '';
        for (const [key, value] of Object.entries(this.fullContextValue)) {
            result += `${key}=${value};`;
        }
        return result;
    }

    private get _effectiveDescription(): string | undefined {
        return this._temporaryDescription || this.description;
    }

    public get fullId(): string {
        if (this.parent === undefined) {
            return ''; // root tree item should not have an id since it's not actually displayed
        } else {
            let id: string = this.id || this.label;
            if (!id.startsWith('/')) {
                id = `/${id}`;
            }

            // For the sake of backwards compat, only add the parent's id if it's not already there
            if (!id.startsWith(this.parent.fullId)) {
                id = `${this.parent.fullId}${id}`;
            }

            return id;
        }
    }

    public get fullContextValue(): types.IContextValue {
        if (this.parent === undefined) {
            return this.contextValue; // root tree item should not have an id since it's not actually displayed
        } else {
            return {
                ...this.parent.contextValue,
                ...this.contextValue
            };
        }
    }

    public get effectiveIconPath(): types.TreeItemIconPath | undefined {
        return this._temporaryDescription || this._isLoadingMore ? getThemedIconPath('Loading') : this.iconPath;
    }

    public get effectiveLabel(): string {
        return this._effectiveDescription ? `${this.label} (${this._effectiveDescription})` : this.label;
    }

    public get treeDataProvider(): IAzExtTreeDataProviderInternal {
        // tslint:disable-next-line: strict-boolean-expressions
        return this._treeDataProvider || nonNullProp(this, 'parent').treeDataProvider;
    }

    public set treeDataProvider(val: IAzExtTreeDataProviderInternal) {
        this._treeDataProvider = val;
    }

    //#region Methods implemented by base class
    public refreshImpl?(): Promise<void>;
    public deleteTreeItemImpl?(deleteTreeItemImpl: types.IActionContext): Promise<void>;
    public onTreeItemPicked?(context: types.ITreeItemWizardContext): Promise<void>;
    //#endregion

    public async refresh(): Promise<void> {
        await this.treeDataProvider.refresh(this);
    }

    public matchesContextValue(expectedContextValue: types.IExpectedContextValue, includeId: boolean = true): boolean {
        for (const [key, value] of Object.entries(expectedContextValue)) {
            if (key !== 'id' || includeId) {
                // todo case insensitive key
                const actualValue: string | undefined = this.fullContextValue[key];
                if (actualValue !== undefined) {
                    if ((value instanceof RegExp && !value.test(actualValue)) || (typeof value === 'string' && value.toLowerCase() !== actualValue.toLowerCase())) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    public isAncestorOfImpl(expectedContextValue: types.IExpectedContextValue): boolean {
        return isAzExtParentTreeItem(this) && this.matchesContextValue(expectedContextValue, false /* includeId */);
    }

    public includeInTreePicker(expectedContextValue: types.IExpectedContextValue): boolean {
        return this.matchesContextValue(expectedContextValue) || this.isAncestorOfImpl(expectedContextValue);
    }

    public async withDeleteProgress(callback: () => Promise<void>): Promise<void> {
        await this.withTemporaryDescription(localize('deleting', 'Deleting...'), async () => {
            await callback();
            this.parent?.removeChildFromCache(this);
        });
    }

    public async withTemporaryDescription(description: string, callback: () => Promise<void>): Promise<void> {
        this._temporaryDescription = description;
        try {
            this.treeDataProvider.refreshUIOnly(this);
            await callback();
        } finally {
            this._temporaryDescription = undefined;
            await this.refresh();
        }
    }
}
