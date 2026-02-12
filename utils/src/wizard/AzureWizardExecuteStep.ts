/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Progress } from 'vscode';
import type { IActionContext } from '../types/actionContext';
import type { ExecuteActivityContext, ExecuteActivityOutput } from '../types/activity';
import type { AzureWizardExecuteStepOptions } from '../types/wizard';

export abstract class AzureWizardExecuteStep<T extends IActionContext & Partial<ExecuteActivityContext>> {
    public id?: string;
    public options: AzureWizardExecuteStepOptions = {};

    public abstract priority: number;
    public configureBeforeExecute?(wizardContext: T): void | Promise<void>;
    public abstract execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void>;
    public abstract shouldExecute(wizardContext: T): boolean;
    public addExecuteSteps?(wizardContext: T): AzureWizardExecuteStep<T>[] | Promise<AzureWizardExecuteStep<T>[]>;

    public createSuccessOutput?(context: T): ExecuteActivityOutput;
    public createFailOutput?(context: T): ExecuteActivityOutput;
    public createProgressOutput?(context: T): ExecuteActivityOutput;
}
