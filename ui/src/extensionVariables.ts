/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, OutputChannel } from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
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
}

/**
 * Container for common extension variables used throughout the UI package. They must be initialized with registerUIExtensionVariables
 */
export let ext: UIExtensionVariables = new UninitializedExtensionVariables();

export function registerUIExtensionVariables(extVars: UIExtensionVariables): void {
    ext = extVars;
}
