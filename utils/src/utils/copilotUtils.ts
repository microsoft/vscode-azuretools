/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { IActionContext } from "../..";
import { CopilotUserInput } from "../userInput/CopilotUserInput";

const copilotUserInputCanaryKey = '_copilotUserInput';

export function isCopilotUserInput(context: IActionContext): boolean {
    return !!(context as unknown as Record<string, unknown>)[copilotUserInputCanaryKey];
}

export function markAsCopilotUserInput(context: IActionContext, relevantContext?: string, getLoadingView?: () => vscode.WebviewPanel | undefined): void {
    context.ui = new CopilotUserInput(vscode, relevantContext, getLoadingView);
    (context as unknown as Record<string, unknown>)[copilotUserInputCanaryKey] = true;
}
