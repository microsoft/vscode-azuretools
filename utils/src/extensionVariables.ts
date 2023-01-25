/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { commands, ExtensionContext } from "vscode";
import * as types from "../index";
import { registerErrorHandler } from './callWithTelemetryAndErrorHandling';
import { createTelemetryReporter, IInternalTelemetryReporter } from './createTelemetryReporter';
import { localize } from "./localize";
import { parseError } from './parseError';

interface IInternalExtensionVariables extends types.UIExtensionVariables {
    _internalReporter: IInternalTelemetryReporter;
}

class UninitializedExtensionVariables implements types.UIExtensionVariables {
    private _error: Error = new Error(localize('uninitializedError', '"registerUIExtensionVariables" must be called before using the vscode-azureextensionui package.'));

    public get context(): ExtensionContext {
        throw this._error;
    }

    public get outputChannel(): types.IAzExtOutputChannel {
        throw this._error;
    }

    public get _internalReporter(): IInternalTelemetryReporter {
        throw this._error;
    }
}

/**
 * Container for common extension variables used throughout the UI package. They must be initialized with registerUIExtensionVariables
 */
export let ext: IInternalExtensionVariables = new UninitializedExtensionVariables();

export async function registerUIExtensionVariables(extVars: types.UIExtensionVariables): Promise<void> {
    if (ext === extVars) {
        // already registered
        return;
    }

    assert(extVars.context, 'registerUIExtensionVariables: Missing context');
    assert(extVars.outputChannel, 'registerUIExtensionVariables: Missing outputChannel');

    ext = Object.assign(extVars, { _internalReporter: await createTelemetryReporter(extVars.context) });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    registerErrorHandler(handleEntryNotFound);
}

/**
 * Long-standing issue that is pretty common for all Azure calls, but can be fixed with a simple reload of VS Code
 * https://github.com/microsoft/vscode-azure-account/issues/53
 */
async function handleEntryNotFound(context: types.IErrorHandlerContext): Promise<void> {
    if (parseError(context.error).message === 'Entry not found in cache.') {
        context.error = new Error(localize('mustReload', 'Your VS Code window must be reloaded to perform this action.'));
        context.errorHandling.suppressReportIssue = true;
        context.errorHandling.buttons = [
            {
                title: localize('reloadWindow', 'Reload Window'),
                callback: async (): Promise<void> => {
                    await commands.executeCommand('workbench.action.reloadWindow');
                }
            }
        ];
    }
}
