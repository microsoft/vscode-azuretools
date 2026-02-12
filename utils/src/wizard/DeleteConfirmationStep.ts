/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { IActionContext } from '../types/actionContext';
import { DialogResponses } from "../DialogResponses";
import { AzureWizardPromptStep } from "./AzureWizardPromptStep";

/**
 * @param message Message to display in the confirmation modal
 * ex: `Are you sure you want to delete function app "{0}"?`
 */
export class DeleteConfirmationStep extends AzureWizardPromptStep<IActionContext> {

    public constructor(private readonly message: string) { super(); }

    public async prompt(context: IActionContext): Promise<void> {
        await context.ui.showWarningMessage(this.message, { modal: true, stepName: 'deleteConfirmation' }, DialogResponses.deleteResponse);
    }

    public shouldPrompt(): boolean {
        return true;
    }
}
