/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ViewColumn } from "vscode";
import { WebviewController } from "./extension-server/WebviewController";
import { ext } from "./extensionVariables";

export type LoadingViewControllerType = {
    title: string;
}

export class LoadingViewController extends WebviewController<LoadingViewControllerType> {
    constructor(viewConfiguration: LoadingViewControllerType) {
        super(ext.context, viewConfiguration.title, 'loadingView', viewConfiguration, ViewColumn.Active);
    }
}
