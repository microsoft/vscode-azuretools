/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputBoxOptions, QuickPickItem, QuickPickOptions } from "vscode";

export interface IWizardUserInput extends IRootUserInput {
    isPrompting: boolean;
    showBackButton: boolean;
}

export interface IRootUserInput {
    showQuickPick<T extends QuickPickItem>(picks: T[] | Thenable<T[]>, options: QuickPickOptions): Thenable<T>;
    showInputBox(options: InputBoxOptions): Thenable<string | undefined>;
}
