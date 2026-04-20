/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, runGenericPromptStep, type IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { LoadingViewController } from "./LoadingViewController";
import { SharedState } from "./SharedViewState";

export class OpenLoadingViewStep<T extends IActionContext> extends AzureWizardPromptStep<T> {
    public async prompt(): Promise<void> {
        const loadingView = new LoadingViewController({ title: vscode.l10n.t('Loading...') });
        loadingView.revealToForeground(vscode.ViewColumn.Active);
        SharedState.currentPanel = loadingView.panel;
        SharedState.loadingViewController = loadingView;
    }

    public shouldPrompt(): boolean {
        return true;
    }
}

export async function openLoadingViewPanel(context: IActionContext): Promise<void> {
    const promptSteps: AzureWizardPromptStep<IActionContext>[] = [new OpenLoadingViewStep<IActionContext>()];

    return await runGenericPromptStep(context, {
        promptSteps
    });
}
