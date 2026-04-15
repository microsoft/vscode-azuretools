/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { AzureWizardPromptStep, ConfirmationViewProperty, IActionContext } from "@microsoft/vscode-azext-utils";
import type { ExtensionContext, MessageItem, WebviewPanel } from "vscode";

export declare const SharedState: {
    itemsToClear: number;
    cancelled: boolean;
    copilotClicked: boolean;
    editingPicks: boolean;
    currentPanel: WebviewPanel | undefined;
};

export declare class OpenConfirmationViewStep<T extends IActionContext> extends AzureWizardPromptStep<T> {
    constructor(title: string, tabTitle: string, description: string, commandName: string, viewConfig: () => ConfirmationViewProperty[]);
    prompt(context: T): Promise<void>;
    shouldPrompt(): boolean;
}

export declare class OpenLoadingViewStep<T extends IActionContext> extends AzureWizardPromptStep<T> {
    prompt(): Promise<void>;
    shouldPrompt(): boolean;
}

export declare function confirmationViewButtonActions(context: IActionContext, result: MessageItem | undefined): Promise<void>;

export declare namespace ext {
    let context: ExtensionContext;
}

export declare function registerWebviewExtensionVariables(context: ExtensionContext): void;

export declare function openLoadingViewPanel(context: IActionContext): Promise<void>;
