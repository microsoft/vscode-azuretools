/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizard } from './AzureWizard';

export abstract class AzureWizardPromptStep<T> {
    public subWizard?: AzureWizard<T>;
    public abstract prompt(wizardContext: T): Promise<T>;
}
