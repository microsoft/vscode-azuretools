/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureUserInput } from '../../index';
import { AzureWizard } from './AzureWizard';

export abstract class AzureWizardPromptStep<T> {
    public subWizard?: AzureWizard<T>;
    public abstract prompt(wizardContext: T, ui: IAzureUserInput): Promise<T>;
}
