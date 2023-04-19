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

    public static async create(): Promise<TestUserInput> {
        return new TestUserInput(await import('vscode'));
    }

    public get onDidFinishPrompt(): vscodeTypes.Event<types.PromptResult> {
        return this._onDidFinishPromptEmitter.event;
    }

    public async runWithInputs<T>(inputs: (string | RegExp | types.TestInput)[], callback: () => Promise<T>): Promise<T> {
        this.setInputs(inputs);
        const result: T = await callback();
        this.validateAllInputsUsed();
        return result;
    }

    public setInputs(inputs: (string | RegExp | types.TestInput)[]): void {
        this._inputs = <(string | RegExp | TestInput)[]>inputs;
    }

    public validateAllInputsUsed(): void {
        assert.strictEqual(this._inputs.length, 0, `Not all inputs were used: ${this._inputs.toString()}`);
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
                    const description = qpi.description || '';
                    const valuesToTest = [qpi.label, description, `${qpi.label} ${description}`];
                    return valuesToTest.some(v => input instanceof RegExp ? input.test(v) : input === v);
                }

                if (options.canPickMany) {
                    result = resolvedItems.filter(qpiMatchesInput);
                } else {
                    const resolvedItem: T | undefined = resolvedItems.find(qpiMatchesInput);
                    if (resolvedItem) {
                        result = resolvedItem;
                    } else {
                        const picksString = resolvedItems.map(i => `"${i.label}"`).join(', ')
                        const lastItem = resolvedItems[resolvedItems.length - 1];
                        if (/load more/i.test(lastItem.label)) {
                            console.log(`Loading more items for quick pick with placeholder "${options.placeHolder}"...`);
                            result = lastItem;
                            this._inputs.unshift(input);
                        } else {
                            throw new Error(`Did not find quick pick item matching "${input}". Placeholder: "${options.placeHolder}". Picks: ${picksString}`);
                        }
                    }
                }
            }

            this._onDidFinishPromptEmitter.fire({ value: result });
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
                const msg: string | vscodeTypes.InputBoxValidationMessage | null | undefined = await Promise.resolve(options.validateInput(input));
                if (msg !== null && msg !== undefined) {
                    if (typeof msg === 'object' && 'message' in msg) {
                        throw new Error(msg.message);
                    } else {
                        throw new Error(msg);
                    }
                }
            }
            result = input;
        } else {
            throw new Error(`Unexpected input '${input}' for showInputBox.`);
        }

        this._onDidFinishPromptEmitter.fire({
            value: result,
            matchesDefault: result === options.value
        });
        return result;
    }

    public showWarningMessage<T extends vscodeTypes.MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends vscodeTypes.MessageItem>(message: string, options: vscodeTypes.MessageOptions, ...items: T[]): Promise<vscodeTypes.MessageItem>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async showWarningMessage<T extends vscodeTypes.MessageItem>(message: string, ...args: any[]): Promise<T> {
        let result: T;
        const input: string | RegExp | TestInput | undefined = this._inputs.shift();
        if (input === undefined) {
            throw new Error(`No more inputs left for call to showWarningMessage. Message: ${message}`);
        } else if (typeof input === 'string') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const matchingItem: T | undefined = args.find((item: T) => item.title === input);
            if (matchingItem) {
                result = matchingItem;
            } else {
                throw new Error(`Did not find message item matching '${input}'. Message: '${message}'`);
            }
        } else {
            throw new Error(`Unexpected input '${input}' for showWarningMessage.`);
        }

        this._onDidFinishPromptEmitter.fire({ value: result });
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

        this._onDidFinishPromptEmitter.fire({ value: result });
        return result;
    }
}


export async function runWithInputs<T>(callbackId: string, inputs: (string | RegExp | types.TestInput)[], registerOnActionStartHandler: types.registerOnActionStartHandlerType, callback: () => Promise<T>): Promise<T> {
    const testUserInput = await TestUserInput.create();
    testUserInput.setInputs(inputs);
    const disposable = registerOnActionStartHandler((context) => {
        if (context.callbackId === callbackId) {
            context.ui = testUserInput;
            disposable.dispose();
        }
    });

    let result: T;
    try {
        result = await callback();
    } finally {
        disposable.dispose();
    }

    testUserInput.validateAllInputsUsed();
    return result;
}
