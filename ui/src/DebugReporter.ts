/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as console from 'console';
import { IActionContext } from '../index';
import { IInternalTelemetryReporter } from './createTelemetryReporter';

export class DebugReporter implements IInternalTelemetryReporter {
    private readonly sharedProperties: { [key: string]: string } = {};

    constructor(private _extensionName: string, private _extensionVersion: string, private _verbose: boolean) { }

    /**
     * Implements `postEvent` for `IExperimentationTelemetry`.
     * @param eventName The name of the event
     * @param props The properties to attach to the event
     */
    public postEvent(eventName: string, props: Map<string, string>): void {
        const properties: { [key: string]: string } = {};

        for (const key of props.keys()) {
            properties[key] = <string>props.get(key);
        }

        this.sendTelemetryErrorEvent(eventName, properties);
    }

    /**
     * Implements `setSharedProperty` for `IExperimentationTelemetry`
     * @param name The name of the property
     * @param value The value of the property
     */
    public setSharedProperty(name: string, value: string): void {
        this.sharedProperties[name] = value;
    }

    public handleTelemetry(context: IActionContext): void {
        context.telemetry.properties = {
            ...context.telemetry.properties,
            ...this.sharedProperties
        };
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
