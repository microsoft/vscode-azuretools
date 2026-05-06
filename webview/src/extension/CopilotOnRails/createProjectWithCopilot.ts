/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { type IActionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { CreateProjectViewController } from "../../webview/CopilotOnRails/CreateProjectViewController";

export function createProjectWithCopilot(_context: IActionContext): void {
    const controller = new CreateProjectViewController({
        title: vscode.l10n.t('Create with Copilot'),
    });
    controller.revealToForeground();
}
