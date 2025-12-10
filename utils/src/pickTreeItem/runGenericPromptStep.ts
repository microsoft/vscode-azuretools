/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { AzureWizard } from '../wizard/AzureWizard';

export async function runGenericPromptStep(context: types.PickExperienceContext, wizardOptions?: types.IWizardOptions<types.AzureResourceQuickPickWizardContext>): Promise<void> {
    const wizard = new AzureWizard(context, {
        hideStepCount: true,
        showLoadingPrompt: wizardOptions?.showLoadingPrompt ?? true,
        ...wizardOptions
    });

    await wizard.prompt();
}
