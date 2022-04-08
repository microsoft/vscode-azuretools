/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/


import { randomUUID } from "crypto";
import { Event, EventEmitter, Progress, TreeItemCollapsibleState } from "vscode";
import * as types from '../../index';
import { parseError } from "../parseError";
import { AzExtTreeItem } from "../tree/AzExtTreeItem"

export interface ActivityTreeItemOptions {
    label: string;
    contextValuePostfix?: string;
    collapsibleState?: TreeItemCollapsibleState;
    children?: (parent: types.AzExtParentTreeItem) => AzExtTreeItem[];
}

type ActivityEventData<T> = ActivityTreeItemOptions & T;

export interface ActivityProgressEventData extends ActivityTreeItemOptions {
    message: string;
}

export type OnStartActivityData = ActivityEventData<{}>;
export type OnProgressActivityData = ActivityEventData<{ message?: string }>;
export type OnSuccessActivityData = ActivityEventData<{}>;
export type OnErrorActivityData = ActivityEventData<{ error: unknown }>;

export interface Activity {
    id: string;
    onStart: Event<OnStartActivityData>;
    onProgress: Event<OnProgressActivityData>;
    onSuccess: Event<OnSuccessActivityData>;
    onError: Event<OnErrorActivityData>;
}

// use functions instead of events for easier error
export interface ActivityFuncs {
    id: string;
    onStart: (data: OnStartActivityData) => Promise<void>;
    onProgress: (data: OnProgressActivityData) => Promise<void>;
    onSuccess: (data: OnSuccessActivityData) => Promise<void>;
    onError: (data: OnErrorActivityData) => Promise<void>;
}

export interface ActivityType {
    initialState(): ActivityTreeItemOptions;
    successState(): ActivityTreeItemOptions;
    errorState(error: types.IParsedError): ActivityTreeItemOptions;
}

export type ActivityTask = (progress: Progress<{ message?: string, increment?: number }>) => Promise<void>;

export abstract class ActivityBase implements Activity, ActivityType {

    public readonly onStart: typeof this._onStartEmitter.event;
    public readonly onProgress: typeof this._onProgressEmitter.event;
    public readonly onSuccess: typeof this._onSuccessEmitter.event;
    public readonly onError: typeof this._onErrorEmitter.event;

    private readonly _onStartEmitter: EventEmitter<OnStartActivityData>;
    private readonly _onProgressEmitter: EventEmitter<OnProgressActivityData>;
    private readonly _onSuccessEmitter: EventEmitter<OnSuccessActivityData>;
    private readonly _onErrorEmitter: EventEmitter<OnErrorActivityData>;

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

        this._onStartEmitter = new EventEmitter();
        this._onProgressEmitter = new EventEmitter();
        this._onSuccessEmitter = new EventEmitter();
        this._onErrorEmitter = new EventEmitter();

        this.onStart = this._onStartEmitter.event;
        this.onProgress = this._onProgressEmitter.event;
        this.onSuccess = this._onSuccessEmitter.event;
        this.onError = this._onErrorEmitter.event;
    }

    public report(progress: { message?: string; increment?: number }): void {
        this.progress.unshift(progress);
        this._onProgressEmitter.fire({ ...this.getState(), message: progress.message });
    }

    public async run(activityFuncs: ActivityFuncs): Promise<void> {
        try {
            activityFuncs.onStart(this.getState());
            this._onStartEmitter.fire(this.getState());
            await this.task({ report: (progress) => this.report(progress) });
            this.done = true;
            this._onSuccessEmitter.fire(this.getState());
        } catch (e) {
            this.error = parseError(e);
            this.done = true;
            this._onErrorEmitter.fire({ ...this.getState(), error: e });
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
