/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { CopilotClient, CopilotSession } from '@github/copilot-sdk';
import type * as vscodeTypes from 'vscode';
import { workspace } from 'vscode';
import * as types from '../../index';
import { createCopilotSession, createPrimaryPromptForInputBox, createPrimaryPromptForWarningMessage, createPrimaryPromptForWorkspaceFolderPick, createPrimaryPromptToGetPickManyQuickPickInput, createPrimaryPromptToGetSingleQuickPickInput, sendCopilotInteraction } from '../copilot/copilot';
import { InvalidCopilotResponseError } from '../errors';

export class CopilotUserInput implements types.IAzureUserInput {
    private readonly _vscode: typeof vscodeTypes;
    private readonly _onDidFinishPromptEmitter: vscodeTypes.EventEmitter<types.PromptResult>;
    private readonly _relevantContext: string | undefined;
    public getLoadingView: undefined | (() => vscodeTypes.WebviewPanel | undefined);

    private _session: CopilotSession | undefined;
    private _client: CopilotClient | undefined;
    private _sessionPromise: Promise<CopilotSession> | undefined;

    constructor(vscode: typeof vscodeTypes, relevantContext?: string, getLoadingView?: () => vscodeTypes.WebviewPanel | undefined) {
        this._vscode = vscode;
        this._onDidFinishPromptEmitter = new this._vscode.EventEmitter<types.PromptResult>();
        this._relevantContext = relevantContext;
        this.getLoadingView = getLoadingView;
    }

    private async getSession(): Promise<CopilotSession> {
        if (this._session) {
            return this._session;
        }
        // Avoid creating multiple sessions if called concurrently
        if (!this._sessionPromise) {
            this._sessionPromise = createCopilotSession(this._relevantContext).then(({ session, client }) => {
                this._session = session;
                this._client = client;
                return session;
            });
        }
        return this._sessionPromise;
    }

    public async dispose(): Promise<void> {
        if (this._client) {
            await this._client.stop();
            this._client = undefined;
            this._session = undefined;
            this._sessionPromise = undefined;
        }
    }

    public async showWarningMessage<T extends vscodeTypes.MessageItem>(message: string, ...items: T[]): Promise<T> {
        const session = await this.getSession();
        const primaryPrompt: string = createPrimaryPromptForWarningMessage(message, items);
        const response = await sendCopilotInteraction(session, primaryPrompt);

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
        const session = await this.getSession();
        const primaryPrompt: string = createPrimaryPromptForWorkspaceFolderPick(workspace.workspaceFolders, this._relevantContext);
        const response = await sendCopilotInteraction(session, primaryPrompt);
        const pick = (workspace.workspaceFolders ?? []).find(folder => {
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
                const session = await this.getSession();
                const primaryPrompt: string = createPrimaryPromptForInputBox(options.prompt, this._relevantContext);
                const response = await sendCopilotInteraction(session, primaryPrompt);
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
        const session = await this.getSession();

        // Clean up items to only include label and description
        const cleanedItems = this.cleanQuickPickItems(resolvedItems);
        const jsonItems = cleanedItems.map(item => JSON.stringify(item));
        try {
            if (options.canPickMany) {
                primaryPrompt = createPrimaryPromptToGetPickManyQuickPickInput(jsonItems, this._relevantContext);
                const response = await sendCopilotInteraction(session, primaryPrompt);
                const jsonResponse: T[] = JSON.parse(response) as T[];
                const picks = resolvedItems.filter(item => {
                    return jsonResponse.some(resp => JSON.stringify(resp.label) === JSON.stringify(item.label) &&
                        JSON.stringify(resp.description || '') === JSON.stringify(item.description || ''));
                });

                if (!picks || picks.length === 0) {
                    throw new InvalidCopilotResponseError();
                }

                this._onDidFinishPromptEmitter.fire({ value: picks });

                return picks;
            } else {
                primaryPrompt = createPrimaryPromptToGetSingleQuickPickInput(jsonItems, options.placeHolder);
                const response = await sendCopilotInteraction(session, primaryPrompt);
                const jsonResponse: T = JSON.parse(response) as T;
                const pick = resolvedItems.find(item => {
                    return JSON.stringify(item.label) === JSON.stringify(jsonResponse.label) &&
                        JSON.stringify(item.description || '') === JSON.stringify(jsonResponse.description || '');
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

    private cleanQuickPickItems<T extends types.IAzureQuickPickItem<unknown>>(items: T[]): { label: string, description: string, id: string | undefined }[] {
        return items.map(item => ({
            label: item.label,
            description: item.description || '',
            id: (item.data && typeof item.data === 'object' && 'id' in item.data) ? String(item.data.id) : undefined
        }));
    }
}
