/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ThemeColor, ThemeIcon, TreeItemCollapsibleState } from "vscode";
import * as types from "../../index";
import { localize } from "../localize";
import { AzExtParentTreeItem } from "../tree/AzExtParentTreeItem";
import { AzExtTreeItem } from "../tree/AzExtTreeItem";
import { ActivityBase } from "./Activity";

export class ActivityTreeItem extends AzExtParentTreeItem {

    private latestProgress?: { message?: string, increment?: number } | undefined;

    public constructor(parent: AzExtParentTreeItem, public readonly activity: ActivityBase) {
        super(parent);
        this.latestProgress = this.activity.progress[0];
        activity.onReportProgress((progress) => {
            this.latestProgress = progress;
            this.treeDataProvider.refreshUIOnly(this);
        });
    }

    public get id(): string {
        return this.activity.id;
    }

    public get contextValue(): string {
        const postfix = this.activity.state.contextValuePostfix ? `.${this.activity.state.contextValuePostfix}` : '';
        return `azureOperation.${this.activity.done ? this.activity.error ? 'failed' : 'succeeded' : 'running'}${postfix}`;
    }

    public collapsibleState: TreeItemCollapsibleState = this.activity.state.collapsibleState ?? this.activity.done ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None;

    public get label(): string {
        return this.activity.state.label;
    }

    public get description(): string | undefined {

        if (this.latestProgress && this.latestProgress.message && !this.activity.done) {
            return this.latestProgress.message;
        }

        return this.stateValue({
            running: this.latestProgress?.message,
            succeeded: localize('succeded', 'Succeeded'),
            failed: localize('failed', 'Failed'),
        });
    }

    public get iconPath(): types.TreeItemIconPath | undefined {
        return this.stateValue({
            running: new ThemeIcon('loading~spin'),
            succeeded: new ThemeIcon('pass', new ThemeColor('testing.iconPassed')),
            failed: new ThemeIcon('error', new ThemeColor('testing.iconFailed')),
        });
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, _context: types.IActionContext): Promise<AzExtTreeItem[]> {
        if (this.activity.state.children) {
            return this.activity.state.children(this);
        }
        return [];
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    private stateValue<T>(values: { running: T, succeeded: T, failed: T }): T {
        if (this.activity.done) {
            return this.activity.error ? values.failed : values.succeeded;
        }
        return values.running;
    }
}
