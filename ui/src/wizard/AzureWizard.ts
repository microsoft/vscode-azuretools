/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '../../index';
import { ext } from '../extensionVariables';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';

export class AzureWizard<T> {
    protected _parentWizard?: AzureWizard<T>;
    private readonly _promptSteps: AzureWizardPromptStep<T>[];
    private readonly _executeSteps: AzureWizardExecuteStep<T>[];
    private readonly _subWizards: AzureWizard<T>[] = [];
    private _wizardContext: T;

    public constructor(promptSteps: AzureWizardPromptStep<T>[], executeSteps: AzureWizardExecuteStep<T>[], wizardContext: T) {
        this._promptSteps = promptSteps;
        this._executeSteps = executeSteps;
        this._wizardContext = wizardContext;
    }

    public async prompt(actionContext: IActionContext): Promise<T> {
        for (const step of this._promptSteps) {
            // We want to encourage the least number of prompts possible, so only prompt for a step that doesn't already exist in the parent
            if (this._parentWizard && this._parentWizard.containsStep(step)) {
                break;
            }

            actionContext.properties.lastStepAttempted = `prompt-${step.constructor.name}`;
            this._wizardContext = await step.prompt(this._wizardContext);

            if (step.subWizard) {
                step.subWizard._parentWizard = this;
                this._subWizards.push(step.subWizard);
                await step.subWizard.prompt(actionContext);
            }
        }

        return this._wizardContext;
    }

    public async execute(actionContext: IActionContext): Promise<T> {
        ext.outputChannel.show(true);

        for (const subWizard of this._subWizards) {
            await subWizard.execute(actionContext);
        }

        for (const step of this._executeSteps) {
            actionContext.properties.lastStepAttempted = `execute-${step.constructor.name}`;
            this._wizardContext = await step.execute(this._wizardContext);
        }

        return this._wizardContext;
    }

    protected containsStep(step: AzureWizardPromptStep<T>): boolean {
        return this._promptSteps.some((s: AzureWizardPromptStep<T>) => s.constructor.name === step.constructor.name) || (!!this._parentWizard && this._parentWizard.containsStep(step));
    }
}
