/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ThemeColor, ThemeIcon, TreeItemCollapsibleState } from "vscode";
import * as types from "../../index";
import { localize } from "../localize";
import { AzExtParentTreeItem } from "../tree/AzExtParentTreeItem";
import { AzExtTreeItem } from "../tree/AzExtTreeItem";
import { ActivityBase, ActivityTreeItemOptions, OnErrorActivityData, OnProgressActivityData, OnStartActivityData, OnSuccessActivityData } from "./Activity";

export interface TreeItemState {
    id: string;
    label: string;
    contextValuePostfix?: string;
    collapsibleState?: TreeItemCollapsibleState;
    children?: (parent: AzExtParentTreeItem) => AzExtTreeItem[];
    iconPath?: types.TreeItemIconPath;
    description?: string;
}

export class ActivityState implements TreeItemState {

    public readonly id: string;

    private latestProgress?: { message?: string };

    public state: ActivityTreeItemOptions = {
        label: 'undefined'
    }

    private done: boolean = false;
    public error: unknown;

    public constructor(activity: ActivityBase) {
        this.id = activity.id;
    }

    public getActivityFuncs(): types.ActivityFuncs {
        return {
            onProgress: this.onProgress.bind(this) as typeof this.onProgress,
            onStart: this.onStart.bind(this) as typeof this.onStart,
            onSuccess: this.onSuccess.bind(this) as typeof this.onSuccess,
            onError: this.onError.bind(this) as typeof this.onError,
        }
    }

    private async onProgress(data: OnProgressActivityData): Promise<void> {
        this.latestProgress = data.message ? { message: data?.message } : this.latestProgress;
        this.state = data;
        await this.refreshInternal();
    }

    private async onStart(data: OnStartActivityData): Promise<void> {
        this.state = data;
        await this.refreshInternal();
    }

    private async onSuccess(data: OnSuccessActivityData): Promise<void> {
        this.state = data;
        this.done = true;
        await this.refreshInternal();
    }

    private async onError(data: OnErrorActivityData): Promise<void> {
        this.state = data;
        this.done = true;
        this.error = data.error;
        await this.refreshInternal();
    }

    private async refreshInternal(): Promise<void> {
        await this.refresh?.();
    }

    public refresh?: () => Promise<void>;

    public children(parent: AzExtParentTreeItem): AzExtTreeItem[] {
        return this.state.children?.(parent) ?? [];
    }

    public get contextValue(): string {
        const postfix = this.state.contextValuePostfix ? `.${this.state.contextValuePostfix}` : '';
        return `azureOperation.${postfix}`;
    }

    public get collapsibleState(): TreeItemCollapsibleState {
        // return TreeItemCollapsibleState.Expanded;
        return this.state.collapsibleState ?? TreeItemCollapsibleState.None;
    }

    public get label(): string {
        return this.state.label;
    }

    public get description(): string | undefined {

        if (this.latestProgress && this.latestProgress.message && !this.done) {
            return this.latestProgress.message;
        }

        return this.stateValue({
            running: this.latestProgress?.message,
            succeeded: localize('succeeded', 'Succeeded'),
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

    private stateValue<T>(values: { running: T, succeeded: T, failed: T }): T {
        if (this.done) {
            return this.error ? values.failed : values.succeeded;
        }
        return values.running;
    }
}
