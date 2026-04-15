/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { ext } from '../extensionVariables';

/**
 * WebviewBaseController is a class that manages a vscode.Webview and provides
 * a way to communicate with it. It provides a way to register request handlers and reducers
 * that can be called from the webview. It also provides a way to post notifications to the webview.
 * @template Configuration The type of the configuration object that the webview will receive
 */
export abstract class WebviewBaseController<Configuration> implements vscode.Disposable {
    private _disposables: vscode.Disposable[] = [];
    private _isDisposed: boolean = false;

    // private _isFirstLoad: boolean = true;
    // private _loadStartTime: number = Date.now();
    private _onDisposed: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    public readonly onDisposed: vscode.Event<void> = this._onDisposed.event;

    /**
     * Creates a new ReactWebviewPanelController
     * @param extensionContext The context of the extension-server
     * @param _webviewName The source file that the webview will use
     * @param configuration The initial state object that the webview will use
     */
    constructor(
        protected extensionContext: vscode.ExtensionContext,
        private _webviewName: string,
        protected configuration: Configuration,
    ) { }

    protected registerDisposable(disposable: vscode.Disposable) {
        this._disposables.push(disposable);
    }

    protected getDocumentTemplate(webview?: vscode.Webview) {
        const nonce = randomBytes(16).toString('base64');

        const filename = 'views.js';
        const uri = (...parts: string[]) => webview?.asWebviewUri(vscode.Uri.file(path.join(ext.context.extensionPath, ...parts))).toString(true);
        const srcUri = uri('dist', filename);
        const cssUri = uri('dist', 'views.css');

        const csp = [
            `form-action 'none';`,
            `default-src ${webview?.cspSource};`,
            `script-src ${webview?.cspSource} 'nonce-${nonce}';`,
            `style-src ${webview?.cspSource} vscode-resource: 'unsafe-inline';`,
            `img-src ${webview?.cspSource} data: vscode-resource:;`,
            `connect-src ${webview?.cspSource} ws:;`,
            `font-src ${webview?.cspSource} data:;`,
            `worker-src ${webview?.cspSource} blob:;`,
        ]
            .join(' ');

        /**
         * Note to code maintainers:
         * encodeURIComponent(JSON.stringify(this.configuration)) below is crucial
         * We want to avoid the webview from crashing when the configuration object contains 'unsupported' bytes
         */

        return `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link href="${cssUri}" rel="stylesheet" />
                    <meta // noinspection JSAnnotator
                        http-equiv="Content-Security-Policy" content="${csp}" />
                </head>
                    <body>
                        <div id="root"></div>

                            <script type="module" nonce="${nonce}">
                                window.config = {
                                    ...window.config,
                                    _initialData: '${encodeURIComponent(JSON.stringify(this.configuration))}'
                            };

                                import { render } from "${srcUri}";
                                render('${this._webviewName}', acquireVsCodeApi());
                            </script>
                    </body>
                </html>`;
    }

    /**
     * Gets whether the controller has been disposed
     */
    public get isDisposed(): boolean {
        return this._isDisposed;
    }

    /**
     * Disposes the controller
     */
    public dispose() {
        this._onDisposed.fire();
        this._disposables.forEach((d) => d.dispose());
        this._isDisposed = true;
    }
}
