/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource, EventEmitter } from "vscode";
import * as hTypes from '../../hostapi';
import * as types from '../../index';
import { crypto } from '../node/crypto';
import { parseError } from "../parseError";
import { dateTimeUtils } from "../utils/dateTimeUtils";

export enum ActivityStatus {
    NotStarted = 'NotStarted',
    Running = 'Running',
    Succeeded = 'Succeeded',
    Failed = 'Failed',
    Cancelled = 'Cancelled',
}

type ActivityBaseOptions = {
    attributes?: types.ActivityAttributes;
    callbackId?: string;
    hasChildren?: boolean;
};

export abstract class ActivityBase<R> implements hTypes.Activity {

    public readonly onStart: typeof this._onStartEmitter.event;
    public readonly onProgress: typeof this._onProgressEmitter.event;
    public readonly onSuccess: typeof this._onSuccessEmitter.event;
    public readonly onError: typeof this._onErrorEmitter.event;

    private readonly _onStartEmitter = new EventEmitter<hTypes.OnStartActivityData>();
    private readonly _onSuccessEmitter = new EventEmitter<hTypes.OnSuccessActivityData>();
    private readonly _onErrorEmitter = new EventEmitter<hTypes.OnErrorActivityData>();
    protected readonly _onProgressEmitter = new EventEmitter<hTypes.OnProgressActivityData>();

    protected status: ActivityStatus = ActivityStatus.NotStarted;
    protected timerMessage: string = '0s';

    private timer: NodeJS.Timeout;
    private _startTime: Date | undefined;
    private _endTime: Date | undefined;
    protected _attributes: types.ActivityAttributes | undefined;

    public error?: types.IParsedError;
    public readonly task: types.ActivityTask<R>;
    public readonly id: string;
    public readonly cancellationTokenSource: CancellationTokenSource = new CancellationTokenSource();
    public readonly hasChildren?: boolean;
    public readonly callbackId?: string;

    abstract initialState(): hTypes.ActivityTreeItemOptions;
    abstract successState(): hTypes.ActivityTreeItemOptions;
    abstract progressState(): hTypes.ActivityTreeItemOptions;
    abstract errorState(error?: types.IParsedError): hTypes.ActivityTreeItemOptions;

    public get attributes(): types.ActivityAttributes | undefined {
        return this._attributes;
    }

    public get startTime(): Date | undefined {
        return this._startTime;
    }

    public get endTime(): Date | undefined {
        return this._endTime;
    }

    public constructor(task: types.ActivityTask<R>, options?: ActivityBaseOptions) {
        this.id = crypto.randomUUID();
        this.task = task;
        this._attributes = options?.attributes;
        this.hasChildren = options?.hasChildren;
        this.callbackId = options?.callbackId;

        this.onStart = this._onStartEmitter.event;
        this.onProgress = this._onProgressEmitter.event;
        this.onSuccess = this._onSuccessEmitter.event;
        this.onError = this._onErrorEmitter.event;
    }

    protected report(_progress?: { message?: string; increment?: number }): void {
        this._onProgressEmitter.fire({ ...this.getState(), message: this.timerMessage });
        this.status = ActivityStatus.Running;
    }

    public async run(): Promise<R> {
        try {
            this._startTime = new Date();
            this._onStartEmitter.fire(this.getState());
            this.startTimer(this._startTime.getTime());
            const result = await this.task({ report: this.report.bind(this) as typeof this.report }, this.cancellationTokenSource.token);
            this.status = ActivityStatus.Succeeded;
            this._onSuccessEmitter.fire(this.getState());
            return result as R;
        } catch (e) {
            this.error = parseError(e);
            this.status = ActivityStatus.Failed;
            this._onErrorEmitter.fire({ ...this.getState(), error: e });
            throw e;
        } finally {
            clearInterval(this.timer);
            this._endTime = new Date();
        }
    }

    public getState(): hTypes.ActivityTreeItemOptions {
        switch (this.status) {
            case ActivityStatus.Failed:
                return this.errorState(this.error);
            case ActivityStatus.Succeeded:
                return this.successState();
            case ActivityStatus.Running:
                return this.progressState();
            default:
                return this.initialState();
        }
    }

    private startTimer(startTimeMs: number): void {
        this.timer = setInterval(() => {
            this.timerMessage = dateTimeUtils.getFormattedDurationInMinutesAndSeconds(Date.now() - startTimeMs);
            this.report();
        }, 1000);
    }
}
