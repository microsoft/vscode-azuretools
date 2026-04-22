/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ViewColumn } from "vscode";
import { WebviewController } from "../../extension/WebviewController";
import { ext } from "../../extension/extensionVariables";
import { type DeploymentPlanData } from "./DeploymentPlanView";

export class DeploymentPlanViewController extends WebviewController<Record<string, never>> {
    constructor(planData: DeploymentPlanData) {
        super(ext.context, 'Azure Deployment Plan', 'deploymentPlanView', {}, ViewColumn.Active);

        this.panel.webview.onDidReceiveMessage((message: { command: string; data?: unknown }) => {
            switch (message.command) {
                case 'ready':
                    void this.panel.webview.postMessage({ command: 'setDeploymentPlanData', data: planData });
                    break;
                case 'approve':
                    void vscode.window.showInformationMessage('Deployment plan approved.');
                    this.panel.dispose();
                    break;
                case 'subscriptionChanged':
                    void vscode.window.showInformationMessage(`Subscription changed to: ${message.data as string}`);
                    break;
                case 'locationChanged':
                    void vscode.window.showInformationMessage(`Location changed to: ${message.data as string}`);
                    break;
            }
        });
    }

    updateDeploymentPlanData(planData: DeploymentPlanData): void {
        void this.panel.webview.postMessage({ command: 'setDeploymentPlanData', data: planData });
    }
}
