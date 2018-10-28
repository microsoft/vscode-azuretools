/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ExtensionContext, OutputChannel } from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
import { IPackageInfo } from "../";
import { IAzureUserInput, UIExtensionVariables } from "../index";
import { localize } from "./localize";

class UninitializedExtensionVariables implements UIExtensionVariables {
    private _error: Error = new Error(localize('uninitializedError', '"registerUIExtensionVariables" must be called before using the vscode-azureextensionui package.'));

    public get context(): ExtensionContext {
        throw this._error;
    }

    public get outputChannel(): OutputChannel {
        throw this._error;
    }

    public get ui(): IAzureUserInput {
        throw this._error;
    }

    public get reporter(): TelemetryReporter {
        throw this._error;
    }

    public get packageInfo(): IPackageInfo {
        throw this._error;
    }
}

/**
 * Container for common extension variables used throughout the UI package. They must be initialized with registerUIExtensionVariables
 */
export let ext: UIExtensionVariables = new UninitializedExtensionVariables();

export function registerUIExtensionVariables(extVars: UIExtensionVariables): void {
    assert(extVars.context, 'registerUIExtensionVariables: Missing context');
    assert(extVars.outputChannel, 'registerUIExtensionVariables: Missing outputChannel');
    assert(extVars.packageInfo, 'registerUIExtensionVariables: Missing packageInfo');
    assert(extVars.reporter, 'registerUIExtensionVariables: Missing reporter');
    assert(extVars.ui, 'registerUIExtensionVariables: Missing ui');

    assert(extVars.packageInfo.aiKey, 'registerUIExtensionVariables: Missing package aiKey');
    assert(extVars.packageInfo.name, 'registerUIExtensionVariables: Missing package name');
    assert(extVars.packageInfo.publisher, 'registerUIExtensionVariables: Missing package publisher');
    assert(extVars.packageInfo.version, 'registerUIExtensionVariables: Missing package version');

    ext = extVars;
}

export function getExtensionId(): string {
    return `${ext.packageInfo.publisher}.${ext.packageInfo.name}`;
}
