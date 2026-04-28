/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ViewColumn } from "vscode";
import { WebviewController } from "../../extension/WebviewController";
import { ext } from "../../extension/extensionVariables";
import { type PlanData } from "./utils/parseScaffoldPlanMarkdown";

export class ScaffoldPlanViewController extends WebviewController<Record<string, never>> {
    constructor(planData: PlanData) {
        super(ext.context, 'Project Plan', 'scaffoldPlanView', {}, ViewColumn.Active);

        this.panel.webview.onDidReceiveMessage((message: { command: string; data?: PlanData }) => {
            switch (message.command) {
                case 'ready':
                    void this.panel.webview.postMessage({ command: 'setPlanData', data: planData });
                    break;
                case 'approvePlan':
                    void vscode.commands.executeCommand('azureProjectCreation.completeStep', 'projectCreation/plan/definePlan');
                    void vscode.commands.executeCommand('workbench.action.chat.open', {
                        mode: 'azure-project-scaffold',
                        query: 'I approve the plan.',
                    });
                    this.panel.dispose();
                    break;
                case 'editPlan':
                    void vscode.window.showInformationMessage('Plan updated!');
                    this.panel.dispose();
                    break;
            }
        });
    }

    updatePlanData(planData: PlanData): void {
        void this.panel.webview.postMessage({ command: 'setPlanData', data: planData });
    }
}
