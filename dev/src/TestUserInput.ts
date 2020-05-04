/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as vscodeTypes from 'vscode'; // `TestUserInput._vscode` should be used for anything that's not purely a type (e.g. instantiating a class)
import * as types from '../index';

export enum TestInput {
    UseDefaultValue,
    BackButton
}

class GoBackError extends Error {
    constructor() {
        super('Go back.');
    }
}

export class TestUserInput implements types.TestUserInput {
    private readonly _onDidFinishPromptEmitter: vscodeTypes.EventEmitter<types.PromptResult>;
    private readonly _vscode: typeof vscodeTypes;
    private _inputs: (string | RegExp | TestInput)[] = [];

    constructor(vscode: typeof vscodeTypes) {
        this._vscode = vscode;
        this._onDidFinishPromptEmitter = new this._vscode.EventEmitter<types.PromptResult>();
    }

    public get onDidFinishPrompt(): vscodeTypes.Event<types.PromptResult> {
        return this._onDidFinishPromptEmitter.event;
    }

    public async runWithInputs(inputs: (string | RegExp | types.TestInput)[], callback: () => Promise<void>): Promise<void> {
        this._inputs = <(string | RegExp | TestInput)[]>inputs;
        await callback();
        assert.equal(this._inputs.length, 0, `Not all inputs were used: ${this._inputs.toString()}`);
    }

    public async showQuickPick<T extends vscodeTypes.QuickPickItem>(items: T[] | Thenable<T[]>, options: vscodeTypes.QuickPickOptions): Promise<T | T[]> {
        const resolvedItems: T[] = await Promise.resolve(items);

        let result: T | T[];
        const input: string | RegExp | TestInput | undefined = this._inputs.shift();
        if (input === undefined) {
            throw new Error(`No more inputs left for call to showQuickPick. Placeholder: '${options.placeHolder}'`);
        } else if (input === TestInput.BackButton) {
            throw new GoBackError();
        } else {
            if (resolvedItems.length === 0) {
                throw new Error(`No quick pick items found. Placeholder: '${options.placeHolder}'`);
            } else if (input === TestInput.UseDefaultValue) {
                result = resolvedItems[0];
            } else {
                function qpiMatchesInput(qpi: vscodeTypes.QuickPickItem): boolean {
                    return (input instanceof RegExp && (input.test(qpi.label) || (qpi.description && input.test(qpi.description)))) || qpi.label === input || qpi.description === input;
                }

                if (options.canPickMany) {
                    result = resolvedItems.filter(qpiMatchesInput);
                } else {
                    const resolvedItem: T | undefined = resolvedItems.find(qpiMatchesInput);
                    if (resolvedItem) {
                        result = resolvedItem;
                    } else {
                        throw new Error(`Did not find quick pick item matching '${input}'. Placeholder: '${options.placeHolder}'`);
                    }
                }
            }

            this._onDidFinishPromptEmitter.fire(result);
            return result;
        }
    }

    public async showInputBox(options: vscodeTypes.InputBoxOptions): Promise<string> {
        let result: string;
        const input: string | RegExp | TestInput | undefined = this._inputs.shift();
        if (input === undefined) {
            throw new Error(`No more inputs left for call to showInputBox. Placeholder: '${options.placeHolder}'. Prompt: '${options.prompt}'`);
        } else if (input === TestInput.BackButton) {
            throw new GoBackError();
        } else if (input === TestInput.UseDefaultValue) {
            if (!options.value) {
                throw new Error('Can\'t use default value because none was specified');
            } else {
                result = options.value;
            }
        } else if (typeof input === 'string') {
            if (options.validateInput) {
                const msg: string | null | undefined = await Promise.resolve(options.validateInput(input));
                if (msg !== null && msg !== undefined) {
                    throw new Error(msg);
                }
            }
            result = input;
        } else {
            throw new Error(`Unexpected input '${input}' for showInputBox.`);
        }

        this._onDidFinishPromptEmitter.fire(result);
        return result;
    }

    public showWarningMessage<T extends vscodeTypes.MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends vscodeTypes.MessageItem>(message: string, options: vscodeTypes.MessageOptions, ...items: T[]): Promise<vscodeTypes.MessageItem>;
    // tslint:disable-next-line:no-any
    public async showWarningMessage<T extends vscodeTypes.MessageItem>(message: string, ...args: any[]): Promise<T> {
        let result: T;
        const input: string | RegExp | TestInput | undefined = this._inputs.shift();
        if (input === undefined) {
            throw new Error(`No more inputs left for call to showWarningMessage. Message: ${message}`);
        } else if (typeof input === 'string') {
            // tslint:disable-next-line:no-unsafe-any
            const matchingItem: T | undefined = args.find((item: T) => item.title === input);
            if (matchingItem) {
                result = matchingItem;
            } else {
                throw new Error(`Did not find message item matching '${input}'. Message: '${message}'`);
            }
        } else {
            throw new Error(`Unexpected input '${input}' for showWarningMessage.`);
        }

        this._onDidFinishPromptEmitter.fire(result);
        return result;
    }

    public async showOpenDialog(options: vscodeTypes.OpenDialogOptions): Promise<vscodeTypes.Uri[]> {
        let result: vscodeTypes.Uri[];
        const input: string | RegExp | TestInput | undefined = this._inputs.shift();
        if (input === undefined) {
            throw new Error(`No more inputs left for call to showOpenDialog. Message: ${options.openLabel}`);
        } else if (typeof input === 'string') {
            result = [this._vscode.Uri.file(input)];
        } else {
            throw new Error(`Unexpected input '${input}' for showOpenDialog.`);
        }

        this._onDidFinishPromptEmitter.fire(result);
        return result;
    }
}
