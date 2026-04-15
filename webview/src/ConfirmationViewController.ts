/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { type ConfirmationViewProperty } from "@microsoft/vscode-azext-utils";
import { ViewColumn } from "vscode";
import { WebviewController } from "./extension-server/WebviewController";
import { ext } from "./extensionVariables";

export type ConfirmationViewControllerType = {
    title: string;
    tabTitle: string;
    description: string;
    commandName: string; // only used to help construct the copilot prompt
    items: Array<ConfirmationViewProperty>
}

export class ConfirmationViewController extends WebviewController<ConfirmationViewControllerType> {
    constructor(viewConfig: ConfirmationViewControllerType) {
        super(ext.context, viewConfig.tabTitle, 'confirmationView', viewConfig, ViewColumn.Active);
    }
}
