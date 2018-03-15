/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputChannel } from 'vscode';
import { IAzureUserInput } from '../../index';

export abstract class AzureWizardStep<T> {
    public abstract prompt(wizardContext: T, ui: IAzureUserInput): Promise<T>;
    public abstract execute(wizardContext: T, outputChannel: OutputChannel): Promise<T>;
}
