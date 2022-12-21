/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IActionContext } from "../..";
import { localize } from "../localize";

interface IConfirmInputOptions {
    prompt?: string;
    isPassword?: boolean;
}

export class ConfirmPreviousInputStep<T extends IActionContext> extends AzureWizardPromptStep<T> {
    constructor(private readonly key: string, private readonly options?: IConfirmInputOptions) {
        super();
    }

    public async prompt(context: T): Promise<void> {
        await context.ui.showInputBox({
            prompt: this.options?.prompt || localize('verifyPreviousInput', 'Please confirm by re-entering the previous value.'),
            password: this.options?.isPassword,
            validateInput: (value: string | undefined) => this.validateInput(context, value)
        });
    }

    public shouldPrompt(): boolean {
        return true;
    }

    private validateInput(context: T, value: string | undefined): string | undefined {
        const valueMismatch: string = localize('valueMismatch', 'The entered value does not match the original.');
        return (context[this.key] === value?.trim()) ? undefined : valueMismatch;
    }
}
