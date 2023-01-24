/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import TelemetryReporter from '@vscode/extension-telemetry';
import * as process from 'process';
import * as vscode from 'vscode';
import { DebugReporter } from './DebugReporter';
import { getPackageInfo } from './getPackageInfo';

const debugTelemetryEnabled: boolean = !/^(false|0)?$/i.test(process.env.DEBUGTELEMETRY || '');
const debugTelemetryVerbose: boolean = /^(verbose|v)$/i.test(process.env.DEBUGTELEMETRY || '');

export interface IInternalTelemetryReporter {
    sendTelemetryErrorEvent(eventName: string, properties?: { [key: string]: string | undefined }, measurements?: { [key: string]: number | undefined }, errorProps?: string[]): void;
}

export async function createTelemetryReporter(ctx: vscode.ExtensionContext): Promise<IInternalTelemetryReporter> {
    const { extensionName, extensionVersion, aiKey } = await getPackageInfo(ctx);

    let newReporter: IInternalTelemetryReporter;

    if (debugTelemetryEnabled) {
        console.warn(`${extensionName}: DEBUGTELEMETRY mode enabled (${debugTelemetryVerbose ? 'verbose' : 'quiet'}) - not sending telemetry`);
        newReporter = new DebugReporter(extensionName, extensionVersion, debugTelemetryVerbose);
    } else {
        const reporter: TelemetryReporter = new TelemetryReporter(extensionName, extensionVersion, aiKey);
        ctx.subscriptions.push(reporter);
        newReporter = reporter;
    }

    // Send an event with some general info
    newReporter.sendTelemetryErrorEvent('info', { isActivationEvent: 'true', product: vscode.env.appName, language: vscode.env.language }, undefined, []);

    return newReporter;
}
