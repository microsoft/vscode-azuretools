/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { IActionContext } from '../types/actionContext';
import type { IConfirmInputOptions } from '../types/wizard';
import { AzureWizardPromptStep } from "./AzureWizardPromptStep";

/**
 * @param key The context key that will be used to retrieve the value for comparison
 * @param options (Optional) The options to pass when creating the prompt step
 * ex: 'Please confirm by re-entering the previous value.'
 */
export class ConfirmPreviousInputStep extends AzureWizardPromptStep<IActionContext> {
    constructor(private readonly key: string, private readonly options?: IConfirmInputOptions) {
        super();
    }

    public async prompt(context: IActionContext): Promise<void> {
        await context.ui.showInputBox({
            prompt: this.options?.prompt ?? vscode.l10n.t('Please confirm by re-entering the previous value.'),
            password: this.options?.isPassword,
            validateInput: (value?: string) => this.validateInput(context, value)
        });
    }

    public shouldPrompt(): boolean {
        return true;
    }

    private validateInput(context: IActionContext, value?: string): string | undefined {
        const valueMismatch: string = vscode.l10n.t('The entered value does not match the original.');
        return (context[this.key] === value?.trim()) ? undefined : valueMismatch;
    }
}
