/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { DeploymentPlanViewController } from "../../webview/CopilotOnRails/DeploymentPlanViewController";
import { parseDeploymentPlanMarkdown } from "../../webview/CopilotOnRails/utils/parseDeploymentPlanMarkdown";

let currentDeploymentPlanViewController: DeploymentPlanViewController | undefined;

export function isDeploymentPlanViewOpen(): boolean {
    return currentDeploymentPlanViewController !== undefined;
}

export function openDeploymentPlanView(uri: vscode.Uri): void {
    void openDeploymentPlanViewAsync(uri);
}

export function openDeploymentPlanViewWithContent(content: string): void {
    const planData = parseDeploymentPlanMarkdown(content);

    if (currentDeploymentPlanViewController) {
        currentDeploymentPlanViewController.updateDeploymentPlanData(planData);
        return;
    }

    currentDeploymentPlanViewController = new DeploymentPlanViewController(planData);
    currentDeploymentPlanViewController.revealToForeground(vscode.ViewColumn.Active);
    currentDeploymentPlanViewController.panel.onDidDispose(() => {
        currentDeploymentPlanViewController = undefined;
    });
}

export async function openDeploymentPlanViewFromWorkspace(): Promise<void> {
    const files = await vscode.workspace.findFiles('**/.azure/plan.md', '**/node_modules/**', 10);
    if (files.length === 0) {
        void vscode.window.showInformationMessage('No deployment plan markdown files found in the workspace.');
        return;
    }

    let selected: vscode.Uri;
    if (files.length === 1) {
        selected = files[0];
    } else {
        const picked = await vscode.window.showQuickPick(
            files.map((f) => ({ label: vscode.workspace.asRelativePath(f), uri: f })),
            { placeHolder: 'Select a deployment plan file to open' },
        );
        if (!picked) {
            return;
        }
        selected = picked.uri;
    }

    await openDeploymentPlanViewAsync(selected);
}

async function openDeploymentPlanViewAsync(uri: vscode.Uri): Promise<void> {
    const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
    const planData = parseDeploymentPlanMarkdown(content);

    // If a deployment plan view is already open, just refresh its data
    if (currentDeploymentPlanViewController) {
        currentDeploymentPlanViewController.updateDeploymentPlanData(planData);
        return;
    }

    currentDeploymentPlanViewController = new DeploymentPlanViewController(planData);
    currentDeploymentPlanViewController.revealToForeground(vscode.ViewColumn.Active);
    currentDeploymentPlanViewController.panel.onDidDispose(() => {
        currentDeploymentPlanViewController = undefined;
    });
}
