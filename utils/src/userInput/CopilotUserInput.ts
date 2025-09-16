/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import type * as vscodeTypes from 'vscode';
import { workspace } from 'vscode';
import * as types from '../../index';
import { createPrimaryPromptForInputBox, createPrimaryPromptForWarningMessage, createPrimaryPromptForWorkspaceFolderPick, createPrimaryPromptToGetPickManyQuickPickInput, createPrimaryPromptToGetSingleQuickPickInput, doCopilotInteraction } from '../copilot/copilot';
import { InvalidCopilotResponseError } from '../errors';

export class CopilotUserInput implements types.IAzureUserInput {
    private readonly _vscode: typeof vscodeTypes;
    private readonly _onDidFinishPromptEmitter: vscodeTypes.EventEmitter<types.PromptResult>;
    private readonly _relevantContext: string | undefined;
    public getLoadingView: undefined | (() => vscodeTypes.WebviewPanel | undefined);

    constructor(vscode: typeof vscodeTypes, relevantContext?: string, getLoadingView?: () => vscodeTypes.WebviewPanel | undefined) {
        this._vscode = vscode;
        this._onDidFinishPromptEmitter = new this._vscode.EventEmitter<types.PromptResult>();
        this._relevantContext = relevantContext;
        this.getLoadingView = getLoadingView;
    }

    public async showWarningMessage<T extends vscodeTypes.MessageItem>(message: string, ...items: T[]): Promise<T> {
        const primaryPrompt: string = createPrimaryPromptForWarningMessage(message, items);
        const response = await doCopilotInteraction(primaryPrompt)

        const pick = items.find(
            item => {
                return item.title === response;
            }
        );

        if (!pick) {
            throw new InvalidCopilotResponseError();
        }

        this._onDidFinishPromptEmitter.fire({ value: pick });
        return pick;
    }

    public showOpenDialog(): Promise<vscodeTypes.Uri[]> {
        // Throw this back to the user
        throw new InvalidCopilotResponseError();
    }

    public async showWorkspaceFolderPick(_options: types.AzExtWorkspaceFolderPickOptions,): Promise<vscodeTypes.WorkspaceFolder> {
        const primaryPrompt: string = createPrimaryPromptForWorkspaceFolderPick(workspace.workspaceFolders, this._relevantContext);
        const response = await doCopilotInteraction(primaryPrompt)
        const pick = (workspace.workspaceFolders || []).find(folder => {
            return folder.name === response;
        });

        if (!pick) {
            throw new InvalidCopilotResponseError();
        }

        this._onDidFinishPromptEmitter.fire({ value: pick });
        return pick;
    }

    public async showInputBox(options: vscodeTypes.InputBoxOptions): Promise<string> {
        if (options.prompt) {
            try {
                const primaryPrompt: string = createPrimaryPromptForInputBox(options.prompt, this._relevantContext);
                const response = await doCopilotInteraction(primaryPrompt);
                const jsonResponse: string = JSON.parse(response) as string;
                this._onDidFinishPromptEmitter.fire({ value: jsonResponse });
                return jsonResponse;
            } catch {
                // if copilot is unable to provide a response, fall back to the default value if it exists
                return this.defaultValueFallback(options);
            }
        } else {
            return this.defaultValueFallback(options);
        }
    }

    private defaultValueFallback(options: vscodeTypes.InputBoxOptions): string {
        if (options.value) {
            this._onDidFinishPromptEmitter.fire({ value: options.value });
            return options.value;
        }
        throw new InvalidCopilotResponseError();
    }

    public get onDidFinishPrompt(): vscodeTypes.Event<types.PromptResult> {
        return this._onDidFinishPromptEmitter.event;
    }

    public async showQuickPick<T extends types.IAzureQuickPickItem<unknown>>(items: T[] | Thenable<T[]>, options: vscodeTypes.QuickPickOptions): Promise<T | T[]> {
        let primaryPrompt: string;
        const resolvedItems: T[] = await Promise.resolve(items);
        const jsonItems: string[] = resolvedItems.map(item => JSON.stringify(item));
        try {
            if (options.canPickMany) {
                primaryPrompt = createPrimaryPromptToGetPickManyQuickPickInput(jsonItems, this._relevantContext);
                const response = await doCopilotInteraction(primaryPrompt);
                const jsonResponse: T[] = JSON.parse(response) as T[];
                const picks = resolvedItems.filter(item => {
                    return jsonResponse.some(resp => JSON.stringify(resp) === JSON.stringify(item));
                });

                if (!picks || picks.length === 0) {
                    throw new InvalidCopilotResponseError();
                }

                this._onDidFinishPromptEmitter.fire({ value: picks });

                return picks;
            } else {
                primaryPrompt = createPrimaryPromptToGetSingleQuickPickInput(jsonItems, this._relevantContext);
                const response = await doCopilotInteraction(primaryPrompt);
                const jsonResponse: T = JSON.parse(response) as T;
                const pick = resolvedItems.find(item => {
                    return JSON.stringify(item) === JSON.stringify(jsonResponse);
                });

                if (!pick) {
                    throw new InvalidCopilotResponseError();
                }

                this._onDidFinishPromptEmitter.fire({ value: pick });

                return pick;
            }
        } catch {
            throw new InvalidCopilotResponseError();
        }
    }
}
