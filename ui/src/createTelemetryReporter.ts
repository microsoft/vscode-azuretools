/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as process from 'process';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { IExperimentationTelemetry } from 'vscode-tas-client';
import { DebugReporter } from './DebugReporter';
import { getPackageInfo } from './getPackageInfo';

// tslint:disable-next-line:strict-boolean-expressions
export const debugTelemetryEnabled: boolean = !/^(false|0)?$/i.test(process.env.DEBUGTELEMETRY || '');
// tslint:disable-next-line:strict-boolean-expressions
const debugTelemetryVerbose: boolean = /^(verbose|v)$/i.test(process.env.DEBUGTELEMETRY || '');

export interface IInternalTelemetryReporter extends IExperimentationTelemetry {
    sendTelemetryErrorEvent(eventName: string, properties?: { [key: string]: string | undefined }, measurements?: { [key: string]: number | undefined }, errorProps?: string[]): void;
}

export function createTelemetryReporter(ctx: vscode.ExtensionContext): IInternalTelemetryReporter {
    const { extensionName, extensionVersion, aiKey } = getPackageInfo(ctx);

    let newReporter: IInternalTelemetryReporter;

    if (debugTelemetryEnabled) {
        console.warn(`${extensionName}: DEBUGTELEMETRY mode enabled (${debugTelemetryVerbose ? 'verbose' : 'quiet'}) - not sending telemetry`);
        newReporter = new DebugReporter(extensionName, extensionVersion, debugTelemetryVerbose);
    } else {
        const reporter: InternalTelemetryReporter = new InternalTelemetryReporter(extensionName, extensionVersion, aiKey);
        ctx.subscriptions.push(reporter);
        newReporter = reporter;
    }

    // Send an event with some general info
    newReporter.sendTelemetryErrorEvent('info', { isActivationEvent: 'true', product: vscode.env.appName, language: vscode.env.language }, undefined, []);

    return newReporter;
}

class InternalTelemetryReporter extends TelemetryReporter implements IInternalTelemetryReporter {
    private readonly sharedProperties: { [key: string]: string } = {};

    /**
     * Implements `postEvent` for `IExperimentationTelemetry`.
     * @param eventName The name of the event
     * @param props The properties to attach to the event
     */
    public postEvent(eventName: string, props: Map<string, string>): void {
        const properties: { [key: string]: string } = { ...this.sharedProperties };

        for (const key of props.keys()) {
            properties[key] = <string>props.get(key);
        }

        this.sendTelemetryEvent(eventName, properties);
    }

    /**
     * Implements `setSharedProperty` for `IExperimentationTelemetry`
     * @param name The name of the property
     * @param value The value of the property
     */
    public setSharedProperty(name: string, value: string): void {
        this.sharedProperties[name] = value;
    }
}
