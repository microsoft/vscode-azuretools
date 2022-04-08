/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/


import { randomUUID } from "crypto";
import { Progress, TreeItemCollapsibleState } from "vscode";
import * as types from '../../index';
import { parseError } from "../parseError";
import { AzExtParentTreeItem } from "../tree/AzExtParentTreeItem";
import { AzExtTreeItem } from "../tree/AzExtTreeItem"

export declare interface ActivityTreeItemOptions {
    label: string;
    contextValuePostfix?: string;
    collapsibleState?: TreeItemCollapsibleState;
    children?: (parent: AzExtParentTreeItem) => AzExtTreeItem[];
}

type ActivityEventData<T> = ActivityTreeItemOptions & T;

export declare type OnStartActivityData = ActivityEventData<{}>;
export declare type OnProgressActivityData = ActivityEventData<{ message?: string }>;
export declare type OnSuccessActivityData = ActivityEventData<{}>;
export declare type OnErrorActivityData = ActivityEventData<{ error: unknown }>;

export declare interface ActivityType {
    initialState(): ActivityTreeItemOptions;
    successState(): ActivityTreeItemOptions;
    errorState(error: types.IParsedError): ActivityTreeItemOptions;
}

export interface ActivityProgressEventData extends ActivityTreeItemOptions {
    message: string;
}

export interface ActivityType {
    initialState(): ActivityTreeItemOptions;
    successState(): ActivityTreeItemOptions;
    errorState(error: types.IParsedError): ActivityTreeItemOptions;
}

export type ActivityTask = (progress: Progress<{ message?: string, increment?: number }>) => Promise<void>;

export abstract class ActivityBase implements ActivityType {

    public done: boolean;
    public error?: types.IParsedError;
    public readonly task: ActivityTask;
    public startedAtMs: number;
    public readonly id: string;

    public progress: { message?: string, increment?: number }[];

    abstract initialState(): ActivityTreeItemOptions;
    abstract successState(): ActivityTreeItemOptions;
    abstract errorState(error: types.IParsedError): ActivityTreeItemOptions;

    public constructor(task: ActivityTask) {
        this.id = randomUUID();
        this.done = false;
        this.startedAtMs = Date.now();
        this.task = task;
        this.progress = [];
    }

    public async run({ onStart, onProgress, onSuccess, onError }: types.ActivityFuncs): Promise<void> {
        try {
            await onStart(this.getState());
            await this.task({
                report: async (progress) => {
                    this.progress.unshift(progress);
                    await onProgress({ ...this.getState(), message: progress.message });
                }
            });
            this.done = true;
            await onSuccess(this.getState());
        } catch (e) {
            this.error = parseError(e);
            this.done = true;
            await onError({ ...this.getState(), error: e });
            throw e;
        }
    }

    public getState(): ActivityTreeItemOptions {
        if (this.done) {
            return this.error ? this.errorState(this.error) : this.successState();
        }
        return this.initialState();
    }
}
