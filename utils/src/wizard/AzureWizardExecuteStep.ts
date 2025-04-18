/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Progress } from 'vscode';
import * as types from '../../index';

export abstract class AzureWizardExecuteStep<T extends types.IActionContext & Partial<types.ExecuteActivityContext>> implements types.AzureWizardExecuteStep<T> {
    public id?: string;
    public options: types.AzureWizardExecuteStepOptions = {};

    public abstract priority: number;
    public configureBeforeExecute?(wizardContext: T): void | Promise<void>;
    public abstract execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public abstract shouldExecute(wizardContext: T): boolean;
    public addExecuteSteps?(wizardContext: T): types.AzureWizardExecuteStep<T>[] | Promise<types.AzureWizardExecuteStep<T>[]>;

    public createSuccessOutput?(context: T): types.ExecuteActivityOutput;
    public createFailOutput?(context: T): types.ExecuteActivityOutput;
    public createProgressOutput?(context: T): types.ExecuteActivityOutput;
}
