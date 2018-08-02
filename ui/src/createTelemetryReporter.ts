/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as debug from 'debug';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ITelemetryReporter } from '../index';

// To enable: set DEBUG=vscode-azureextensionui:telemetry
// See https://www.npmjs.com/package/debug for more info
const log: debug.IDebugger = debug('vscode-azureextensionui:telemetry');
// tslint:disable-next-line:no-unsafe-any no-console
log.log = console.log.bind(console);

class DebugReporter extends vscode.Disposable implements ITelemetryReporter {
    private _packageInfo: IPackageInfo;

    constructor(ctx: vscode.ExtensionContext) {
        super(() => {
            // Nothing to dispose
        });

        this._packageInfo = getPackageInfo(ctx);
    }

    public sendTelemetryEvent(eventName: string, properties?: { [key: string]: string; }, measures?: { [key: string]: number; }): void {
        // tslint:disable-next-line:strict-boolean-expressions
        const propertiesString: string = JSON.stringify(properties || {});
        // tslint:disable-next-line:strict-boolean-expressions
        const measuresString: string = JSON.stringify(measures || {});
        log(`** TELEMETRY("${this._packageInfo.name}/${eventName}", ${this._packageInfo.version}) properties=${propertiesString}, measures=${measuresString}`);
    }
}

export function createTelemetryReporter(ctx: vscode.ExtensionContext): ITelemetryReporter {
    const packageInfo: IPackageInfo = getPackageInfo(ctx);
    let reporter: ITelemetryReporter & vscode.Disposable;

    if (log.enabled) {
        reporter = new DebugReporter(ctx);
    } else {
        reporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
        ctx.subscriptions.push(reporter);
    }

    return reporter;
}

interface IPackageInfo {
    name: string;
    version: string;
    aiKey: string;
}

function getPackageInfo(context: vscode.ExtensionContext): IPackageInfo {
    // tslint:disable-next-line:non-literal-require no-unsafe-any
    const extensionPackage: IPackageInfo = require(context.asAbsolutePath('./package.json'));
    return {
        name: extensionPackage.name,
        version: extensionPackage.version,
        aiKey: extensionPackage.aiKey
    };
}
