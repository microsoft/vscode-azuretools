/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as debug from 'debug';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ITelemetryReporter } from '../index';
import { extInitialized } from './extensionVariables';
import { getPackageInfo } from './getPackageInfo';

// To enable: set DEBUG=vscode-azureextensionui:telemetry
// See https://www.npmjs.com/package/debug for more info
const log: debug.IDebugger = debug('vscode-azureextensionui:telemetry');
// tslint:disable-next-line:no-unsafe-any no-console
log.log = console.log.bind(console);

class DebugReporter implements ITelemetryReporter {
    constructor(private _extensionName: string, private _extensionVersion: string) {
    }

    public sendTelemetryEvent(eventName: string, properties?: { [key: string]: string; }, measures?: { [key: string]: number; }): void {
        try {
            // tslint:disable-next-line:strict-boolean-expressions
            const propertiesString: string = JSON.stringify(properties || {});
            // tslint:disable-next-line:strict-boolean-expressions
            const measuresString: string = JSON.stringify(measures || {});
            log(`** TELEMETRY("${this._extensionName}/${eventName}", ${this._extensionVersion}) properties=${propertiesString}, measures=${measuresString}`);
        } catch (error) {
            console.error(error);
        }
    }
}

export function createTelemetryReporter(ctx: vscode.ExtensionContext): ITelemetryReporter {
    assert(extInitialized, 'Must call registerUIExtensionVariables before calling createTelemetryReporter');

    const { extensionName, extensionVersion, aiKey } = getPackageInfo(ctx);

    if (log.enabled || !aiKey) {
        return new DebugReporter(extensionName, extensionVersion);
    } else {
        const reporter: TelemetryReporter = new TelemetryReporter(extensionName, extensionVersion, aiKey);
        ctx.subscriptions.push(reporter);
        return reporter;
    }
}
