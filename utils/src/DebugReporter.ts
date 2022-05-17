/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as console from 'console';
import { IInternalTelemetryReporter } from './createTelemetryReporter';

export class DebugReporter implements IInternalTelemetryReporter {
    constructor(private _extensionName: string, private _extensionVersion: string, private _verbose: boolean) { }

    public sendTelemetryErrorEvent(eventName: string, properties?: { [key: string]: string | undefined; }, measures?: { [key: string]: number | undefined; }, _errorProps?: string[]): void {
        try {
            const propertiesString: string = JSON.stringify(properties || {});
            const measuresString: string = JSON.stringify(measures || {});

            if (this._verbose) {
                const msg: string = `** TELEMETRY("${this._extensionName}/${eventName}", ${this._extensionVersion}) properties=${propertiesString}, measures=${measuresString}`;
                console.log(msg);
            }
        } catch (error) {
            console.error(`ERROR (DebugReporter): ${error}`);
        }
    }
}
