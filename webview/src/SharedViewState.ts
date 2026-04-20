/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { type WebviewPanel } from 'vscode';

export interface ILoadingViewController {
    addProgressItem(name: string): void;
}

export const SharedState: {
    itemsToClear: number;
    cancelled: boolean;
    copilotClicked: boolean;
    editingPicks: boolean;
    currentPanel: WebviewPanel | undefined;
    loadingViewController: ILoadingViewController | undefined;
} = {
    itemsToClear: 0,
    cancelled: true,
    copilotClicked: false,
    editingPicks: false,
    currentPanel: undefined,
    loadingViewController: undefined,
};

export function resetSharedState(): void {
    SharedState.itemsToClear = 0;
    SharedState.cancelled = true;
    SharedState.copilotClicked = false;
    SharedState.editingPicks = false;
    SharedState.loadingViewController = undefined;
}

/**
 * Utility function to update the loading view with progress.
 * Call this from prompt steps after they complete to show progress in the loading view.
 *
 * @param name - The name/label of the completed item
 */
export function updateLoadingViewProgress(name: string): void {
    SharedState.loadingViewController?.addProgressItem(name);
}
