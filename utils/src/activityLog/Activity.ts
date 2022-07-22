/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { randomUUID } from "crypto";
import { CancellationTokenSource, EventEmitter } from "vscode";
import * as types from '../../index';
import * as hTypes from '../../hostapi';
import { parseError } from "../parseError";

export class ActivityBase<R> implements hTypes.Activity {

    public readonly onStart: typeof this._onStartEmitter.event;
    public readonly onProgress: typeof this._onProgressEmitter.event;
    public readonly onSuccess: typeof this._onSuccessEmitter.event;
    public readonly onError: typeof this._onErrorEmitter.event;

    private readonly _onStartEmitter = new EventEmitter<hTypes.OnStartActivityData>();
    private readonly _onProgressEmitter = new EventEmitter<hTypes.OnProgressActivityData>();
    private readonly _onSuccessEmitter = new EventEmitter<hTypes.OnSuccessActivityData>();
    private readonly _onErrorEmitter = new EventEmitter<hTypes.OnErrorActivityData>();

    public status: types.ActivityStatus = types.ActivityStatus.NotStarted;
    public error?: types.IParsedError;
    public readonly task: types.ActivityTask<R>;
    public readonly id: string;
    public readonly cancellationTokenSource: CancellationTokenSource = new CancellationTokenSource();

    public constructor(task: types.ActivityTask<R>, private readonly optionsFactory: types.ActivityTreeItemOptionsFactory) {
        this.id = randomUUID();
        this.task = task;

        this.onStart = this._onStartEmitter.event;
        this.onProgress = this._onProgressEmitter.event;
        this.onSuccess = this._onSuccessEmitter.event;
        this.onError = this._onErrorEmitter.event;
    }

    private report(progress: { message?: string; increment?: number }): void {
        this._onProgressEmitter.fire({ ...this.options, message: progress.message });
    }

    public async run(): Promise<R> {
        try {
            this.status = types.ActivityStatus.Running;
            this._onStartEmitter.fire(this.options);
            const result = await this.task({ report: this.report.bind(this) as typeof this.report }, this.cancellationTokenSource.token);
            this.status = types.ActivityStatus.Succeeded;
            this._onSuccessEmitter.fire(this.options);
            return result as R;
        } catch (e) {
            this.error = parseError(e);
            this.status = types.ActivityStatus.Failed;
            this._onErrorEmitter.fire({ ...this.options, error: this.error });
            throw e;
        }
    }

    public get options(): hTypes.ActivityTreeItemOptions {
        return this.optionsFactory.getOptions(this);
    }
}
