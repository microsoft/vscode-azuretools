/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as console from 'console';
import { ITelemetryReporter } from '../index';

export class DebugReporter implements ITelemetryReporter {
    constructor(private _extensionName: string, private _extensionVersion: string) {
    }

    public sendTelemetryEvent(eventName: string, properties?: { [key: string]: string | undefined; }, measures?: { [key: string]: number | undefined; }): void {
        try {
            // tslint:disable-next-line:strict-boolean-expressions
            const propertiesString: string = JSON.stringify(properties || {});
            // tslint:disable-next-line:strict-boolean-expressions
            const measuresString: string = JSON.stringify(measures || {});
            // tslint:disable-next-line:no-console
            console.log(`** TELEMETRY("${this._extensionName}/${eventName}", ${this._extensionVersion}) properties=${propertiesString}, measures=${measuresString}`);
        } catch (error) {
            console.error(error);
        }
    }
}
