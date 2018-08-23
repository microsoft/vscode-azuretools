/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputChannel } from "vscode";
import { IAzureUserInput, registerUIExtensionVariables, UIExtensionVariables } from 'vscode-azureextensionui';
import { localize } from "./localize";

/**
 * Interface for common extension variables used throughout the AppService package.
 */
export interface IAppServiceExtensionVariables {
    outputChannel: OutputChannel;
    ui: IAzureUserInput;
}

class UninitializedExtensionVariables implements IAppServiceExtensionVariables {
    private _error: Error = new Error(localize('uninitializedError', '"registerAppServiceExtensionVariables" must be called before using the vscode-azureappservice package.'));

    public get outputChannel(): OutputChannel {
        throw this._error;
    }

    public get ui(): IAzureUserInput {
        throw this._error;
    }
}

/**
 * Container for common extension variables used throughout the AppService package. They must be initialized with registerAppServiceExtensionVariables
 */
export let ext: IAppServiceExtensionVariables = new UninitializedExtensionVariables();

/**
 * Call this to register common variables used throughout the AppService package.
 */
export function registerAppServiceExtensionVariables(extVars: UIExtensionVariables): void {
    ext = extVars;
    registerUIExtensionVariables(extVars);
}
