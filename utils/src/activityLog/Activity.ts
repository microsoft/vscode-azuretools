/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { randomUUID } from "crypto";
import { CancellationTokenSource, EventEmitter } from "vscode";
import * as types from '../../index';
import * as hTypes from '../../hostapi';
import { parseError } from "../parseError";

export enum ActivityStatus {
    NotStarted = 'NotStarted',
    Running = 'Running',
    Succeeded = 'Succeeded',
    Failed = 'Failed',
    Cancelled = 'Cancelled',
}

export abstract class ActivityBase<R> implements hTypes.Activity {

    public readonly onStart: typeof this._onStartEmitter.event;
    public readonly onProgress: typeof this._onProgressEmitter.event;
    public readonly onSuccess: typeof this._onSuccessEmitter.event;
    public readonly onError: typeof this._onErrorEmitter.event;

    private readonly _onStartEmitter = new EventEmitter<hTypes.OnStartActivityData>();
    private readonly _onProgressEmitter = new EventEmitter<hTypes.OnProgressActivityData>();
    private readonly _onSuccessEmitter = new EventEmitter<hTypes.OnSuccessActivityData>();
    private readonly _onErrorEmitter = new EventEmitter<hTypes.OnErrorActivityData>();

    private status: ActivityStatus = ActivityStatus.NotStarted;
    public error?: types.IParsedError;
    public readonly task: types.ActivityTask<R>;
    public readonly id: string;
    public readonly cancellationTokenSource: CancellationTokenSource = new CancellationTokenSource();

    abstract initialState(): hTypes.ActivityTreeItemOptions;
    abstract successState(): hTypes.ActivityTreeItemOptions;
    abstract errorState(error?: types.IParsedError): hTypes.ActivityTreeItemOptions;

    public constructor(task: types.ActivityTask<R>) {
        this.id = randomUUID();
        this.task = task;

        this.onStart = this._onStartEmitter.event;
        this.onProgress = this._onProgressEmitter.event;
        this.onSuccess = this._onSuccessEmitter.event;
        this.onError = this._onErrorEmitter.event;
    }

    private report(progress: { message?: string; increment?: number }): void {
        this._onProgressEmitter.fire({ ...this.getState(), message: progress.message });
    }

    public async run(): Promise<R> {
        try {
            this._onStartEmitter.fire(this.getState());
            const result = await this.task({ report: this.report.bind(this) as typeof this.report }, this.cancellationTokenSource.token);
            this.status = ActivityStatus.Succeeded;
            this._onSuccessEmitter.fire(this.getState());
            return result as R;
        } catch (e) {
            this.error = parseError(e);
            this.status = ActivityStatus.Failed;
            this._onErrorEmitter.fire({ ...this.getState(), error: e });
            throw e;
        }
    }

    public getState(): hTypes.ActivityTreeItemOptions {
        switch (this.status) {
            case ActivityStatus.Failed:
                return this.errorState(this.error);
            case ActivityStatus.Succeeded:
                return this.successState();
            default:
                return this.initialState();
        }
    }
}
