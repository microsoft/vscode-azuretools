/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as types from "../../index";
import { AzureWizardPromptStep } from "./AzureWizardPromptStep";

export class ConfirmPreviousInputStep extends AzureWizardPromptStep<types.IActionContext> {
    constructor(private readonly key: string, private readonly options?: types.IConfirmInputOptions) {
        super();
    }

    public async prompt(context: types.IActionContext): Promise<void> {
        await context.ui.showInputBox({
            prompt: this.options?.prompt ?? vscode.l10n.t('Please confirm by re-entering the previous value.'),
            password: this.options?.isPassword,
            validateInput: (value?: string) => this.validateInput(context, value)
        });
    }

    public shouldPrompt(): boolean {
        return true;
    }

    private validateInput(context: types.IActionContext, value?: string): string | undefined {
        const valueMismatch: string = vscode.l10n.t('The entered value does not match the original.');
        return (context[this.key] === value?.trim()) ? undefined : valueMismatch;
    }
}
