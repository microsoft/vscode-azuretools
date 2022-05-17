/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureUtilsExtensionVariables, registerAzureUtilsExtensionVariables } from "@microsoft/vscode-azext-azureutils";
import { IAzExtOutputChannel, IAzureUserInput, registerUIExtensionVariables, UIExtensionVariables } from "@microsoft/vscode-azext-utils";
import { ExtensionContext } from "vscode";
import { localize } from "./localize";

class UninitializedExtensionVariables implements UIExtensionVariables, IAzureUtilsExtensionVariables {
    private _error: Error = new Error(localize('uninitializedError', '"registerUIExtensionVariables" must be called before using the vscode-azureappservice package.'));

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

interface IAppServiceExtensionVariables extends UIExtensionVariables, IAzureUtilsExtensionVariables {
    prefix: string;
}

/**
 * Container for common extension variables used throughout the AppService package. They must be initialized with registerAppServiceExtensionVariables
 */
export let ext: IAppServiceExtensionVariables = new UninitializedExtensionVariables();

/**
 * Call this to register common variables used throughout the AppService package.
 */
export function registerAppServiceExtensionVariables(extVars: IAppServiceExtensionVariables): void {
    if (ext === extVars) {
        // already registered
        return;
    }

    ext = extVars;
    registerUIExtensionVariables(extVars);
    registerAzureUtilsExtensionVariables(extVars);
}
