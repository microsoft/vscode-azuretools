/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from "../../index";
import { DialogResponses } from "../DialogResponses";
import { AzureWizardPromptStep } from "./AzureWizardPromptStep";

export class ConfirmationStep extends AzureWizardPromptStep<types.IActionContext> {

    public constructor(private readonly message: string) { super(); }

    public async prompt(context: types.IActionContext): Promise<void> {
        await context.ui.showWarningMessage(this.message, { modal: true, stepName: 'confirmation' }, DialogResponses.yes, DialogResponses.no);
    }

    public shouldPrompt(): boolean {
        return true;
    }
}
