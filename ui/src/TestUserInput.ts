/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputBoxOptions, MessageItem, MessageOptions, QuickPickItem, QuickPickOptions } from 'vscode';
import * as vscode from 'vscode';
import { IAzureUserInput } from '../index';

export class TestUserInput implements IAzureUserInput {
    private _inputs: (string | RegExp | undefined)[];

    constructor(inputs: (string | RegExp | undefined)[]) {
        this._inputs = inputs;
    }

    public async showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T> {
        if (this._inputs.length > 0) {
            const input: string | RegExp | undefined = this._inputs.shift();
            const resolvedItems: T[] = await Promise.resolve(items);

            if (resolvedItems.length === 0) {
                throw new Error(`No quick pick items found. Placeholder: '${options.placeHolder}'`);
            } else if (input instanceof RegExp) {
                const resolvedItem: T | undefined = resolvedItems.find((qpi: T): boolean => {
                    if (qpi.label.match(input) || (qpi.description && qpi.description.match(input))) {
                        return true;
                    } else {
                        return false;
                    }
                });
                if (resolvedItem) {
                    return resolvedItem;
                } else {
                    throw new Error(`Did not find quick pick item matching '${input}'. Placeholder: '${options.placeHolder}'`);
                }
            } else if (input) {
                const resolvedItem: T | undefined = resolvedItems.find((qpi: T) => qpi.label === input || qpi.description === input);
                if (resolvedItem) {
                    return resolvedItem;
                } else {
                    throw new Error(`Did not find quick pick item matching '${input}'. Placeholder: '${options.placeHolder}'`);
                }
            } else {
                // Use default value if input is undefined
                return resolvedItems[0];
            }
        }

        throw new Error(`Unexpected call to showQuickPick. Placeholder: '${options.placeHolder}'`);
    }

    public async showInputBox(options: InputBoxOptions): Promise<string> {
        if (this._inputs.length > 0) {
            let result: string | RegExp | undefined = this._inputs.shift();
            if (result === undefined) {
                // Use default value if input is undefined
                result = options.value;
            }
            if (result instanceof RegExp) {
                throw new Error("Unexpected RegExp input in showInputBox.");
            } else if (result !== undefined) { // Allow "" as a valid input
                if (options.validateInput) {
                    const msg: string | null | undefined = await Promise.resolve(options.validateInput(result));
                    if (msg !== null && msg !== undefined) {
                        throw new Error(msg);
                    }
                }

                return result;
            }
        }

        throw new Error(`Unexpected call to showInputBox. Placeholder: '${options.placeHolder}'. Prompt: '${options.prompt}'`);
    }

    public showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    public showWarningMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Promise<MessageItem>;
    // tslint:disable-next-line:no-any
    public async showWarningMessage<T extends MessageItem>(message: string, ...args: any[]): Promise<T> {
        if (this._inputs.length > 0) {
            const result: string | RegExp | undefined = this._inputs.shift();
            // tslint:disable-next-line:no-unsafe-any
            const matchingItem: T | undefined = args.find((item: T) => item.title === result);
            if (matchingItem) {
                return matchingItem;
            }
        }

        throw new Error(`Unexpected call to showWarningMessage. Message: ${message}`);
    }

    public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        if (this._inputs.length > 0) {
            const result: string | RegExp | undefined = this._inputs.shift();
            if (result instanceof RegExp) {
                throw new Error("Unexpected RegExp input in showOpenDialog.");
            } else if (result) {
                return [vscode.Uri.file(result)];
            }
        }

        throw new Error(`Unexpected call to showOpenDialog. Message: ${options.openLabel}`);
    }
}
