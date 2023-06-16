/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzExtOutputChannel, IAzureUserInput, registerUIExtensionVariables, UIExtensionVariables } from '@microsoft/vscode-azext-utils';
import { ExtensionContext, l10n } from "vscode";

class UninitializedExtensionVariables implements UIExtensionVariables {
    private _error: Error = new Error(l10n.t('"registerAzureUtilsExtensionVariables" must be called before using the vscode-azext-azureutilsa package.'));

    public get context(): ExtensionContext {
        throw this._error;
    }

    public get outputChannel(): IAzExtOutputChannel {
        throw this._error;
    }

    public get ui(): IAzureUserInput {
        throw this._error;
    }

    public get prefix(): string {
        throw this._error;
    }
}

interface IAzureUtilsExtensionVariables extends UIExtensionVariables {
    prefix: string;
}

/**
 * Container for common extension variables used throughout the AppService package. They must be initialized with registerAppServiceExtensionVariables
 */
export let ext: IAzureUtilsExtensionVariables = new UninitializedExtensionVariables();

/**
 * Call this to register common variables used throughout the AppService package.
 */
export function registerAzureUtilsExtensionVariables(extVars: IAzureUtilsExtensionVariables): void {
    if (ext === extVars) {
        // already registered
        return;
    }

    ext = extVars;
    registerUIExtensionVariables(extVars);
}
