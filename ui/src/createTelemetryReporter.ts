/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as process from 'process';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ITelemetryReporter } from '../index';
import { DebugReporter } from './DebugReporter';
import { getPackageInfo } from './getPackageInfo';

// tslint:disable-next-line:strict-boolean-expressions
const debugTelemetryEnabled: boolean = !/^(false|0)?$/i.test(process.env.DEBUGTELEMETRY || '');
// tslint:disable-next-line:strict-boolean-expressions
const debugTelemetryVerbose: boolean = /^(verbose|v)$/i.test(process.env.DEBUGTELEMETRY || '');

export function createTelemetryReporter(ctx: vscode.ExtensionContext): ITelemetryReporter {
    // tslint:disable-next-line: prefer-const
    let { extensionName, extensionVersion, aiKey } = getPackageInfo(ctx);
    extensionName = extensionName.replace('-nightly', '');

    let newReporter: ITelemetryReporter;

    if (debugTelemetryEnabled) {
        console.warn(`${extensionName}: DEBUGTELEMETRY mode enabled (${debugTelemetryVerbose ? 'verbose' : 'quiet'}) - not sending telemetry`);
        newReporter = new DebugReporter(extensionName, extensionVersion, debugTelemetryVerbose);
    } else {
        const reporter: TelemetryReporter = new TelemetryReporter(extensionName, extensionVersion, aiKey);
        ctx.subscriptions.push(reporter);
        newReporter = reporter;
    }

    // Send an event with some general info
    newReporter.sendTelemetryEvent('info', {
        isActivationEvent: 'true',
        product: vscode.env.appName,
        language: vscode.env.language
    });

    return newReporter;
}
