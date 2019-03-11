/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';

export abstract class AzureWizardPromptStep<T> implements types.AzureWizardPromptStep<T> {
    public numSubPromptSteps: number = 0;
    public numSubExecuteSteps: number = 0;
    public propertiesBeforePrompt: string[];

    public abstract prompt(wizardContext: T): Promise<types.ISubWizardOptions<T> | void>;
    public abstract shouldPrompt(wizardContext: T): boolean;
}
