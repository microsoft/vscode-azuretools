/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as console from 'console';
import { IInternalTelemetryReporter } from './createTelemetryReporter';

export class DebugReporter implements IInternalTelemetryReporter {
    constructor(private _extensionName: string, private _extensionVersion: string, private _verbose: boolean) { }

    /**
     * Implements `postEvent` for `IExperimentationTelemetry`.
     */
    public postEvent(): void {
        // Not needed
    }

    /**
     * Implements `setSharedProperty` for `IExperimentationTelemetry`
     */
    public setSharedProperty(): void {
        // Not needed
    }

    public sendTelemetryErrorEvent(eventName: string, properties?: { [key: string]: string | undefined; }, measures?: { [key: string]: number | undefined; }, _errorProps?: string[]): void {
        try {
            // tslint:disable-next-line:strict-boolean-expressions
            const propertiesString: string = JSON.stringify(properties || {});
            // tslint:disable-next-line:strict-boolean-expressions
            const measuresString: string = JSON.stringify(measures || {});

            if (this._verbose) {
                const msg: string = `** TELEMETRY("${this._extensionName}/${eventName}", ${this._extensionVersion}) properties=${propertiesString}, measures=${measuresString}`;
                // tslint:disable-next-line:no-console
                console.log(msg);
            }
        } catch (error) {
            console.error(`ERROR (DebugReporter): ${error}`);
        }
    }
}
