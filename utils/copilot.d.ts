/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as vscodeTypes from 'vscode';
import type { Event, MessageItem, Uri, WorkspaceFolder } from 'vscode';
import type { AzExtInputBoxOptions, AzExtOpenDialogOptions, AzExtWorkspaceFolderPickOptions, IAzureMessageOptions, IAzureQuickPickItem, IAzureQuickPickOptions, IAzureUserInput, IActionContext, PromptResult } from './index';

/**
 * Wrapper class of several `vscode.window` methods that handle user input.
 * This class is meant to only be used for copilot input scenerios
 */
export declare class CopilotUserInput implements IAzureUserInput {
    constructor(vscode: typeof import('vscode'), relevantContext?: string, getLoadingView?: () => vscodeTypes.WebviewPanel | undefined);
    onDidFinishPrompt: Event<PromptResult>;
    showQuickPick<T extends IAzureQuickPickItem>(items: T[] | Thenable<T[]>, options: IAzureQuickPickOptions & { canPickMany: true; }): Promise<T[]>;
    showQuickPick<T extends IAzureQuickPickItem>(items: T[] | Thenable<T[]>, options: IAzureQuickPickOptions): Promise<T>;
    showInputBox(options: AzExtInputBoxOptions): Promise<string>;
    showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    showWarningMessage<T extends MessageItem>(message: string, options: IAzureMessageOptions, ...items: T[]): Promise<T>;
    showOpenDialog(options: AzExtOpenDialogOptions): Promise<Uri[]>;
    showWorkspaceFolderPick(options: AzExtWorkspaceFolderPickOptions): Promise<WorkspaceFolder>;
}

/**
 * Disposes of copilot session created by `CopilotUserInput`
 * Should be called after commands using `CopilotUserInput` to prevent any lingering copilot sessions
 */
export function disposeCopilotSession(): Promise<void>;

/**
 * When setting the ui to `CopilotUserInput`, call this function so that the context can be properly identified
 * @param context The context to mark as using `CopilotUserInput`
 */
export function markAsCopilotUserInput(context: IActionContext, relevantContext?: string, getLoadingView?: () => vscode.WebviewPanel | undefined): void;

export function createPrimaryPromptToGetSingleQuickPickInput(picks: string[], placeholder?: string): string;
export function createPrimaryPromptToGetPickManyQuickPickInput(picks: string[], relevantContext?: string): string;
export function createPrimaryPromptForInputBox(inputQuestion: string, relevantContext?: string): string;
export function createPrimaryPromptForWarningMessage(message: string, items: MessageItem[]): string;
export function createPrimaryPromptForWorkspaceFolderPick(folders: readonly vscode.WorkspaceFolder[] | undefined, relevantContext?: string): string;
export function doGithubCopilotInteraction(primaryPrompt: string, relevantContext?: string): Promise<string>;
export function getCopilotSession(relevantContext?: string): Promise<unknown>;
