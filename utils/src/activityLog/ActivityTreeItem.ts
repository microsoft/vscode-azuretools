/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from "vscode";
import * as types from "../../index";
import { callWithTelemetryAndErrorHandling } from "../callWithTelemetryAndErrorHandling";
import { AzExtParentTreeItem } from "../tree/AzExtParentTreeItem";
import { AzExtTreeItem } from "../tree/AzExtTreeItem";
import { ActivityState } from "./ActivityState";

export class ActivityTreeItem extends AzExtParentTreeItem {

    public constructor(parent: AzExtParentTreeItem, private readonly activity: ActivityState) {
        super(parent);
        this.id = activity.id;
        this.activity.refresh = async () => await this.refreshInternal();
    }

    private async refreshInternal(): Promise<void> {
        await callWithTelemetryAndErrorHandling('refreshActivity', async (context) => {
            await this.refresh(context);
            this.treeDataProvider.refreshUIOnly(this.parent);
        });
    }

    public override get contextValue(): string {
        return this.activity.contextValue;
    }

    public get collapsibleState(): TreeItemCollapsibleState {
        return this.activity.collapsibleState;
    }

    public get label(): string {
        return this.activity.label;
    }

    public get description(): string | undefined {
        return this.activity.description;
    }

    public get iconPath(): types.TreeItemIconPath | undefined {
        return this.activity.iconPath;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, _context: types.IActionContext): Promise<AzExtTreeItem[]> {
        if (this.activity.children) {
            const children = this.activity.children(this);
            return children;
        }
        return [];
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}
