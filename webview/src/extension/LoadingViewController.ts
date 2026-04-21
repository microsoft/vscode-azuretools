/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ViewColumn } from "vscode";
import { LoadingViewCommands } from "../webview/webviewConstants";
import { WebviewController } from "./WebviewController";
import { ext } from "./extensionVariables";

export type LoadingViewProgressItem = {
    name: string;
}

export type LoadingViewControllerType = {
    title: string;
    items?: LoadingViewProgressItem[];
}

export class LoadingViewController extends WebviewController<LoadingViewControllerType> {
    constructor(viewConfiguration: LoadingViewControllerType) {
        super(ext.context, viewConfiguration.title, 'loadingView', viewConfiguration, ViewColumn.Active);
    }

    public addProgressItem(name: string): void {
        void this.panel.webview.postMessage({
            command: LoadingViewCommands.AddProgressItem,
            name
        });
    }
}
