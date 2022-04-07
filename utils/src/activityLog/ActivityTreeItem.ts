/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { Event, ThemeColor, ThemeIcon, TreeItemCollapsibleState } from "vscode";
import * as types from "../../index";
import { callWithTelemetryAndErrorHandling } from "../callWithTelemetryAndErrorHandling";
import { localize } from "../localize";
import { AzExtParentTreeItem } from "../tree/AzExtParentTreeItem";
import { AzExtTreeItem } from "../tree/AzExtTreeItem";
import { Activity, ActivityTreeItemOptions } from "./Activity";

type ExtractEventData<E> = E extends Event<infer T> ? T : never;

export class ActivityTreeItem extends AzExtParentTreeItem {

    private latestProgress?: { message?: string, increment?: number } | undefined;

    private state: ActivityTreeItemOptions = {
        label: 'Waiting for init'
    };

    private done: boolean = false;
    private error: boolean = false;

    public constructor(parent: AzExtParentTreeItem, activity: Activity) {
        super(parent);
        this.id = activity.id;
        this.setupListeners(activity)
    }

    private setupListeners(activity: Activity): void {
        activity.onProgress(this.onProgress);
        activity.onStart(this.onStart);
        activity.onSuccess(this.onSuccess);
        activity.onError(this.onError);
    }

    private async onProgress(data: ExtractEventData<Activity['onProgress']>): Promise<void> {
        this.state = data;
        await this.refreshInternal();
    }

    private async onStart(data: ExtractEventData<Activity['onStart']>): Promise<void> {
        this.state = data;
        await this.refreshInternal();
    }

    private async onSuccess(data: ExtractEventData<Activity['onSuccess']>): Promise<void> {
        this.state = data;
        this.done = true;
        await this.refreshInternal();
    }

    private async onError(data: ExtractEventData<Activity['onError']>): Promise<void> {
        this.state = data;
        this.done = true;
        this.error = true;
        await this.refreshInternal();
    }

    private async refreshInternal(): Promise<void> {
        await callWithTelemetryAndErrorHandling('refreshActivity', async (context) => {
            await this.refresh(context);
        });
    }

    public get contextValue(): string {
        const postfix = this.state.contextValuePostfix ? `.${this.state.contextValuePostfix}` : '';
        return `azureOperation.${postfix}`;
    }

    public collapsibleState: TreeItemCollapsibleState = this.state.collapsibleState ?? TreeItemCollapsibleState.None;

    public get label(): string {
        return this.state.label;
    }

    public get description(): string | undefined {

        if (this.latestProgress && this.latestProgress.message && !this.done) {
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
        if (this.state.children) {
            return this.state.children(this);
        }
        return [];
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    private stateValue<T>(values: { running: T, succeeded: T, failed: T }): T {
        if (this.done) {
            return this.error ? values.failed : values.succeeded;
        }
        return values.running;
    }
}
