/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { nonNullValue } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { SharedState } from './SharedViewState';
import { WebviewBaseController } from './WebviewBaseController';

export type WebviewBundleLocation = {
    /** Absolute path to the directory containing the bundle. */
    distDir: string;
    /** File name of the bundle's entry script (must export `render`). */
    scriptFileName: string;
    /** File name of the bundle's stylesheet. */
    styleFileName: string;
};

/**
 * WebviewController is a class that manages a vscode.WebviewPanel and provides
 * a way to communicate with it. It uses tRPC to handle incoming requests (queries,
 * mutations, and subscriptions) from the webview. Through this controller, the
 * webview can call server-side procedures defined in the `appRouter`.
 *
 * @template Configuration - The type of the configuration object that the webview will receive.
 */
export class WebviewController<Configuration> extends WebviewBaseController<Configuration> {
    private _panel: vscode.WebviewPanel;

    /**
     * Creates a new WebviewController instance.
     *
     * @param context        The extension context.
     * @param title          The title of the webview panel.
     * @param webviewName    The identifier/name for the webview resource.
     * @param initialState   The initial state object that the webview will use on startup.
     * @param viewColumn     The view column in which to show the new webview panel.
     * @param _iconPath      An optional icon to display in the tab of the webview.
     * @param bundleLocation Optional override for where the bundled webview script/styles live.
     *                       Defaults to the bundle that ships inside `@microsoft/vscode-azext-webview`.
     */
    constructor(
        context: vscode.ExtensionContext,
        title: string,
        webviewName: string,
        initialState: Configuration,
        viewColumn: vscode.ViewColumn = vscode.ViewColumn.One,
        private _iconPath?:
            | vscode.Uri
            | {
                readonly light: vscode.Uri;
                readonly dark: vscode.Uri;
            },
        bundleLocation?: WebviewBundleLocation,
    ) {
        super(context, webviewName, initialState, bundleLocation);

        // Create the webview panel
        this._panel = vscode.window.createWebviewPanel('react-webview-' + webviewName, title, viewColumn, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(this.extensionContext.extensionPath),
                ...(bundleLocation ? [vscode.Uri.file(bundleLocation.distDir)] : []),
            ],
        });

        this._panel.webview.html = this.getDocumentTemplate(this._panel.webview);
        this._panel.iconPath = this._iconPath;

        this._panel.webview.onDidReceiveMessage(
            async (message: { command: string, itemsToClear?: number, name?: string, value?: string, commandName?: string }) => {
                // Todo: these are placeholders. May change to using trpc for the webview
                switch (message.command) {
                    case 'cancel':
                        SharedState.cancelled = true;
                        this._panel.dispose();
                        break;
                    case 'confirm':
                        SharedState.cancelled = false;
                        SharedState.itemsToClear = message.itemsToClear ?? 0;
                        this._panel.dispose();
                        break;
                    case 'copilot':
                        SharedState.copilotClicked = true;
                        await vscode.commands.executeCommand("workbench.action.chat.open");
                        await vscode.commands.executeCommand("workbench.action.chat.newChat");
                        await vscode.commands.executeCommand("workbench.action.chat.open", {
                            mode: 'agent',
                            query: createCopilotPromptForConfirmationViewButton(nonNullValue(message.name), nonNullValue(message.value), nonNullValue(message.commandName), 'Azure Container Apps'),
                        });

                        break;
                }
            }
        );

        // Clean up when the panel is disposed
        this.registerDisposable(
            this._panel.onDidDispose(() => {
                this.dispose();
            }),
        );
    }

    /**
     * Retrieves the vscode.Webview associated with this controller.
     * @returns The webview being managed by this controller.
     */
    protected _getWebview(): vscode.Webview {
        return this._panel.webview;
    }

    /**
     * Gets the vscode.WebviewPanel that the controller is managing.
     */
    public get panel(): vscode.WebviewPanel {
        return this._panel;
    }

    /**
     * Reveals the webview in the given column, bringing it to the foreground.
     * Useful if the webview is already open but hidden.
     *
     * @param viewColumn The column to reveal in. Defaults to ViewColumn.One.
     */
    public revealToForeground(viewColumn: vscode.ViewColumn = vscode.ViewColumn.One): void {
        this._panel.reveal(viewColumn, true);
    }
}

export function createCopilotPromptForConfirmationViewButton(name: string, value: string, commandName: string, extension: string): string {
    return `Help explain what ${name}: ${value} means in the context of the "${commandName}" command using the ${extension} extension for VS Code.`;
}
