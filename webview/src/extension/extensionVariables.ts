/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type ExtensionContext } from "vscode";

export namespace ext {
    export let context: ExtensionContext;
    /**
     * Absolute path to the directory containing the webview assets (`views.js` and `views.css`).
     *
     * When unset, the controller falls back to
     * `<extensionPath>/node_modules/@microsoft/vscode-azext-webview/dist`, which only works
     * when the consuming extension is run unbundled. Bundled extensions
     * packaged with `vsce package --no-dependencies` must copy `views.js` / `views.css` into their own bundle output and
     * pass the resulting directory here so the assets resolve at runtime.
     */
    export let webviewAssetsDir: string | undefined;
}

export interface WebviewExtensionVariables {
    context: ExtensionContext;
    /**
     * Absolute path to the directory containing the webview assets (`views.js` and `views.css`).
     * Required for bundled extensions whose VSIX does not ship `node_modules`.
     */
    webviewAssetsDir: string;
}

export function registerWebviewExtensionVariables(extVars: WebviewExtensionVariables): void {
    ext.context = extVars.context;
    ext.webviewAssetsDir = extVars.webviewAssetsDir;
}
