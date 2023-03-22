/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { isWrapper } from '@microsoft/vscode-azureresources-api';
import * as types from '../../index';
import { NoResourceFoundError } from '../errors';
import { AzureWizard } from '../wizard/AzureWizard';
import { getLastNode } from './getLastNode';

export async function runQuickPickWizard<TPick>(context: types.PickExperienceContext, wizardOptions?: types.IWizardOptions<types.AzureResourceQuickPickWizardContext>, startingNode?: unknown): Promise<TPick> {
    // Fill in the `pickedNodes` property
    const wizardContext = { ...context } as types.AzureResourceQuickPickWizardContext;
    wizardContext.pickedNodes = startingNode ? [startingNode] : [];

    const wizard = new AzureWizard(wizardContext, {
        hideStepCount: true,
        showLoadingPrompt: true,
        ...wizardOptions
    });

    await wizard.prompt();

    const lastPickedItem = getLastNode(wizardContext);
    if (!lastPickedItem) {
        throw new NoResourceFoundError(wizardContext);
    } else {
        return (!context.dontUnwrap && isWrapper(lastPickedItem)) ? lastPickedItem.unwrap() : lastPickedItem as unknown as TPick;
    }
}
