/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ScaffoldPlanViewController } from "../../webview/CopilotOnRails/ScaffoldPlanViewController";
import { parseScaffoldPlanMarkdown } from "../../webview/CopilotOnRails/utils/parseScaffoldPlanMarkdown";

let currentPlanViewController: ScaffoldPlanViewController | undefined;

export function isPlanViewOpen(): boolean {
    return currentPlanViewController !== undefined;
}

export function openPlanView(uri: vscode.Uri): void {
    void openPlanViewAsync(uri);
}

export async function openPlanViewFromWorkspace(): Promise<void> {
    const files = await vscode.workspace.findFiles('**/project-plan.md', '**/node_modules/**', 10);
    if (files.length === 0) {
        void vscode.window.showInformationMessage('No plan markdown files found in the workspace.');
        return;
    }

    let selected: vscode.Uri;
    if (files.length === 1) {
        selected = files[0];
    } else {
        const picked = await vscode.window.showQuickPick(
            files.map((f) => ({ label: vscode.workspace.asRelativePath(f), uri: f })),
            { placeHolder: 'Select a plan file to open' },
        );
        if (!picked) {
            return;
        }
        selected = picked.uri;
    }

    await openPlanViewAsync(selected);
}

async function openPlanViewAsync(uri: vscode.Uri): Promise<void> {
    const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
    const planData = parseScaffoldPlanMarkdown(content);

    // If a plan view is already open, just refresh its data
    if (currentPlanViewController) {
        currentPlanViewController.updatePlanData(planData);
        return;
    }

    currentPlanViewController = new ScaffoldPlanViewController(planData);
    currentPlanViewController.revealToForeground(vscode.ViewColumn.Active);
    currentPlanViewController.panel.onDidDispose(() => {
        currentPlanViewController = undefined;
    });
}
