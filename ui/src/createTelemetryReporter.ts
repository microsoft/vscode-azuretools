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

export function createTelemetryReporter(ctx: vscode.ExtensionContext): ITelemetryReporter {
    const { extensionName, extensionVersion, aiKey } = getPackageInfo(ctx);

    if (debugTelemetryEnabled) {
        return new DebugReporter(extensionName, extensionVersion);
    } else {
        const reporter: TelemetryReporter = new TelemetryReporter(extensionName, extensionVersion, aiKey);
        ctx.subscriptions.push(reporter);
        return reporter;
    }
}
