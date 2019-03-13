/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Progress } from 'vscode';
import * as types from '../../index';

export abstract class AzureWizardExecuteStep<T> implements types.AzureWizardExecuteStep<T> {
    public abstract execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public abstract shouldExecute(wizardContext: T): boolean;
}
