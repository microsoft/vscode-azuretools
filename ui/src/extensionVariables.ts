/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ExtensionContext } from "vscode";
import { IAzExtOutputChannel, IAzureUserInput, UIExtensionVariables } from "../index";
import { createTelemetryReporter, IInternalTelemetryReporter } from './createTelemetryReporter';
import { localize } from "./localize";
import { IWizardUserInput } from './wizard/IWizardUserInput';

interface IInternalExtensionVariables extends UIExtensionVariables {
    ui: IAzureUserInput & { wizardUserInput?: IWizardUserInput };
    _internalReporter: IInternalTelemetryReporter;
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

    public get _internalReporter(): IInternalTelemetryReporter {
        throw this._error;
    }
}

/**
 * Container for common extension variables used throughout the UI package. They must be initialized with registerUIExtensionVariables
 */
export let ext: IInternalExtensionVariables = new UninitializedExtensionVariables();

export function registerUIExtensionVariables(extVars: UIExtensionVariables): void {
    if (ext === extVars) {
        // already registered
        return;
    }

    assert(extVars.context, 'registerUIExtensionVariables: Missing context');
    assert(extVars.outputChannel, 'registerUIExtensionVariables: Missing outputChannel');
    assert(extVars.ui, 'registerUIExtensionVariables: Missing ui');

    ext = Object.assign(extVars, { _internalReporter: createTelemetryReporter(extVars.context) });
}
