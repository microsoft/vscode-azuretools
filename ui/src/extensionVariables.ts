/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ExtensionContext, InputBoxOptions, QuickPickItem, QuickPickOptions } from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
import { IAzExtOutputChannel, IAzureUserInput, UIExtensionVariables } from "../index";
import { localize } from "./localize";

export interface IRootUserInput {
    showQuickPick<T extends QuickPickItem>(picks: T[] | Thenable<T[]>, options: QuickPickOptions): Thenable<T>;
    showInputBox(options: InputBoxOptions): Thenable<string | undefined>;
}

interface IInternalExtensionVariables extends UIExtensionVariables {
    ui: IAzureUserInput & { rootUserInput?: IRootUserInput };
}

class UninitializedExtensionVariables implements UIExtensionVariables {
    private _error: Error = new Error(localize('uninitializedError', '"registerUIExtensionVariables" must be called before using the vscode-azureextensionui package.'));

    public get context(): ExtensionContext {
        throw this._error;
    }

    public get outputChannel(): IAzExtOutputChannel {
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
export let ext: IInternalExtensionVariables = new UninitializedExtensionVariables();

export function registerUIExtensionVariables(extVars: UIExtensionVariables): void {
    assert(extVars.context, 'registerUIExtensionVariables: Missing context');
    assert(extVars.outputChannel, 'registerUIExtensionVariables: Missing outputChannel');
    assert(extVars.reporter, 'registerUIExtensionVariables: Missing reporter');
    assert(extVars.ui, 'registerUIExtensionVariables: Missing ui');

    ext = extVars;
}
