/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/


import { randomUUID } from "crypto";
import { Event, EventEmitter, Progress, TreeItemCollapsibleState } from "vscode";
import * as types from '../../index';
import { parseError } from "../parseError";
import { AzExtTreeItem } from "../tree/AzExtTreeItem";

export interface ActivityTreeItemOptions {
    label: string;
    contextValuePostfix?: string;
    collapsibleState?: TreeItemCollapsibleState;
    children?: (parent: types.AzExtParentTreeItem) => AzExtTreeItem[];
}

export interface ActivityType {
    inital(): ActivityTreeItemOptions;
    onSuccess(): ActivityTreeItemOptions;
    onError(error: types.IParsedError): ActivityTreeItemOptions;
}

export type ActivityTask = (progress: Progress<{ message?: string, increment?: number }>) => Promise<void>;

export abstract class ActivityBase implements ActivityType {

    public abstract inital(): ActivityTreeItemOptions;
    public abstract onSuccess(): ActivityTreeItemOptions;
    abstract onError(error: types.IParsedError): ActivityTreeItemOptions;

    public done: boolean;
    public error?: types.IParsedError;
    public readonly task: ActivityTask;
    public startedAtMs: number;
    public readonly id: string;

    private readonly _onDidReportProgressEventEmitter: EventEmitter<{ message?: string, increment?: number }>;
    public readonly onReportProgress: Event<{ message?: string, increment?: number }>;

    public progress: { message?: string, increment?: number }[];

    public constructor(task: ActivityTask) {
        this.id = randomUUID();
        this.done = false;
        this.startedAtMs = Date.now();
        this.task = task;
        this._onDidReportProgressEventEmitter = new EventEmitter<{ message?: string, increment?: number }>();
        this.onReportProgress = this._onDidReportProgressEventEmitter.event;
        this.progress = [];
    }

    public report(progress: { message?: string; increment?: number }): void {
        this.progress.unshift(progress);
        this._onDidReportProgressEventEmitter.fire(progress);
    }

    public async run(): Promise<void> {
        try {
            await this.task({ report: (progress) => this.report(progress) });
            this.done = true;
        } catch (e) {
            this.error = parseError(e);
            this.done = true;
            throw e;
        }
    }

    public get state(): ActivityTreeItemOptions {
        if (this.done) {
            return this.error ? this.onError(this.error) : this.onSuccess();
        }
        return this.inital();
    }
}
