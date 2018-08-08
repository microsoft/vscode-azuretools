/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputBoxOptions, MessageItem, MessageOptions, QuickPickItem, QuickPickOptions } from 'vscode';
import * as vscode from 'vscode';
import { IAzureUserInput } from '../index';

export class TestUserInput implements IAzureUserInput {
    private _inputs: (string | undefined)[];

    constructor(inputs: (string | undefined)[]) {
        this._inputs = inputs;
    }

    public async showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: QuickPickOptions): Promise<T> {
        if (this._inputs.length > 0) {
            const input: string | undefined = this._inputs.shift();
            const resolvedItems: T[] = await Promise.resolve(items);

            if (resolvedItems.length === 0) {
                throw new Error(`No quick pick items found. Placeholder: '${options.placeHolder}'`);
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
            let result: string | undefined = this._inputs.shift();
            if (!result) {
                // Use default value if input is undefined
                result = options.value;
            }

            if (result) {
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
            const result: string | undefined = this._inputs.shift();
            // tslint:disable-next-line:no-unsafe-any
            const matchingItem: T | undefined = args.find((item: T) => item.title === result);
            if (matchingItem) {
                return matchingItem;
            }
        }

        throw new Error(`Unexpected call to showWarningMessage. Message: ${message}`);
    }

    public showInformationMessage<T extends MessageItem>(message: string, ...items: T[]): Thenable<T | undefined>;
    public showInformationMessage<T extends MessageItem>(message: string, options: MessageOptions, ...items: T[]): Thenable<T | undefined>;
    // tslint:disable-next-line:no-any
    public showInformationMessage<T extends MessageItem>(message: string, ...args: any[]): Thenable<T | undefined> {
        if (args.length > 0) {
            if (this._inputs.length > 0 && args.length > 0) {
                const result: string | undefined = this._inputs.shift();
                // tslint:disable-next-line:no-unsafe-any
                const matchingItem: T | undefined = args.find((item: T) => item.title === result);
                if (matchingItem) {
                    return Promise.resolve(matchingItem);
                }
            }
        } else {
            return Promise.resolve(undefined);
        }

        throw new Error(`Unexpected call to showInformationMessage. Message: ${message}`);
    }

    public async showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[]> {
        if (this._inputs.length > 0) {
            const result: string | undefined = this._inputs.shift();
            if (result) {
                return [vscode.Uri.file(result)];
            }
        }

        throw new Error(`Unexpected call to showOpenDialog. Message: ${options.openLabel}`);
    }
}
