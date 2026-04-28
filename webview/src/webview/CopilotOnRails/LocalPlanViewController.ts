/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ViewColumn } from "vscode";
import { WebviewController } from "../../extension/WebviewController";
import { ext } from "../../extension/extensionVariables";
import { type LocalPlanData } from "./utils/parseLocalPlanMarkdown";

export class LocalPlanViewController extends WebviewController<Record<string, never>> {
    constructor(planData: LocalPlanData) {
        super(ext.context, 'Local Dev Plan', 'localPlanView', {}, ViewColumn.Active);

        this.panel.webview.onDidReceiveMessage((message: { command: string; data?: LocalPlanData; prompt?: string }) => {
            switch (message.command) {
                case 'ready':
                    void this.panel.webview.postMessage({ command: 'setLocalPlanData', data: planData });
                    break;
                case 'approvePlan':
                    void vscode.commands.executeCommand('azureProjectCreation.completeStep', 'projectCreation/localDevelopment/defineLocalPlan');
                    void vscode.commands.executeCommand('workbench.action.chat.open', {
                        mode: 'agent',
                        query: 'I approve the local dev plan.',
                    });
                    this.panel.dispose();
                    break;
                case 'submitPlanFeedback': {
                    const query = message.prompt?.trim();
                    if (!query) {
                        return;
                    }
                    // Hand off to Copilot agent to revise local-development-plan.md. Keep the
                    // webview open; it will refresh in place when the file is rewritten.
                    void vscode.commands.executeCommand('workbench.action.chat.open', {
                        mode: 'agent',
                        query,
                    });
                    void this.panel.webview.postMessage({ command: 'revisionInProgress' });
                    break;
                }
                case 'editArchitecture':
                    // TODO: Hook in Copilot command to edit architecture
                    void vscode.window.showInformationMessage('Edit Architecture with Copilot — not yet implemented.');
                    break;
            }
        });
    }

    updatePlanData(planData: LocalPlanData): void {
        void this.panel.webview.postMessage({ command: 'setLocalPlanData', data: planData });
        void this.panel.webview.postMessage({ command: 'revisionComplete' });
    }
}
