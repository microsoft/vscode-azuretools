/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from 'vscode';
import * as types from '../../index';
import { NotImplementedError } from '../errors';
import { localize } from '../localize';
import { nonNullProp } from '../utils/nonNull';
import { getThemedIconPath } from './IconPath';
import { IAzExtParentTreeItemInternal, IAzExtTreeDataProviderInternal, isAzExtParentTreeItem } from "./InternalInterfaces";

export abstract class AzExtTreeItem implements types.AzExtTreeItem {
    //#region Properties implemented by base class
    public abstract label: string;
    public abstract contextValue: string;
    public commandId: string | undefined;
    public commandArgs?: unknown[];
    public suppressMaskLabel?: boolean;
    public hasBeenDeleted?: boolean;

    private _id?: string;
    private _description?: string;
    private _iconPath?: types.TreeItemIconPath;
    private _tooltip?: string;
    //#endregion

    /**
     * Used to prevent VS Code from erroring out on nodes with the same label, but different context values (i.e. a folder and file with the same name)
     */
    public fullIdWithContext?: string;
    public readonly collapsibleState: TreeItemCollapsibleState | undefined;
    public readonly parent: IAzExtParentTreeItemInternal | undefined;
    public isLoadingMore: boolean;
    public readonly valuesToMask: string[] = [];

    private _temporaryDescription?: string;
    private _treeDataProvider: IAzExtTreeDataProviderInternal | undefined;

    public constructor(parent: IAzExtParentTreeItemInternal | undefined) {
        this.parent = parent;
    }

    public get effectiveDescription(): string | undefined {
        return this._temporaryDescription || this.description;
    }

    public get id(): string {
        return this._id || this.label;
    }

    public set id(id: string | undefined) {
        this._id = id;
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

    public set iconPath(iconPath: types.TreeItemIconPath | undefined) {
        this._iconPath = iconPath;
    }

    public get iconPath(): types.TreeItemIconPath | undefined {
        return this._iconPath;
    }

    public get effectiveIconPath(): types.TreeItemIconPath | undefined {
        return this._temporaryDescription || this.isLoadingMore ? getThemedIconPath('Loading') : this.iconPath;
    }

    public get treeDataProvider(): IAzExtTreeDataProviderInternal {
        return this._treeDataProvider || nonNullProp(this, 'parent').treeDataProvider;
    }

    public set treeDataProvider(val: IAzExtTreeDataProviderInternal) {
        this._treeDataProvider = val;
    }

    public get description(): string | undefined {
        return this._description;
    }

    public set description(desc: string | undefined) {
        this._description = desc;
    }

    public get tooltip(): string | undefined {
        return this._tooltip;
    }

    public set tooltip(tt: string | undefined) {
        this._tooltip = tt;
    }

    //#region Methods implemented by base class
    public refreshImpl?(context: types.IActionContext): Promise<void>;
    public isAncestorOfImpl?(contextValue: string | RegExp): boolean;
    public deleteTreeItemImpl?(deleteTreeItemImpl: types.IActionContext): Promise<void>;
    public resolveTooltip?(): Promise<string>;
    //#endregion

    public async refresh(context: types.IActionContext): Promise<void> {
        await this.treeDataProvider.refresh(context, this);
    }

    public matchesContextValue(expectedContextValues: (string | RegExp)[]): boolean {
        return expectedContextValues.some((val: string | RegExp) => {
            return this.contextValue === val || (val instanceof RegExp && val.test(this.contextValue));
        });
    }

    public includeInTreePicker(expectedContextValues: (string | RegExp)[]): boolean {
        if (this.matchesContextValue(expectedContextValues)) {
            return true;
        }

        return expectedContextValues.some((val: string | RegExp) => {
            if (this.isAncestorOfImpl) {
                return this.isAncestorOfImpl(val);
            } else {
                return isAzExtParentTreeItem(this);
            }
        });
    }

    public async deleteTreeItem(context: types.IActionContext): Promise<void> {
        await this.runWithTemporaryDescription(context, localize('deleting', 'Deleting...'), async () => {
            if (this.deleteTreeItemImpl) {
                await this.deleteTreeItemImpl(context);
                if (this.parent) {
                    this.parent.removeChildFromCache(this);
                }
                this.hasBeenDeleted = true;
            } else {
                throw new NotImplementedError('deleteTreeItemImpl', this);
            }
        });
    }

    public async runWithTemporaryDescription(context: types.IActionContext, description: string, callback: () => Promise<void>): Promise<void> {
        this._temporaryDescription = description;
        try {
            this.treeDataProvider.refreshUIOnly(this);
            await callback();
        } finally {
            this._temporaryDescription = undefined;
            await this.refresh(context);
        }
    }
}
