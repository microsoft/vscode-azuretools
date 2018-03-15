/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputChannel } from 'vscode';
import { AzureWizardStep, IActionContext, IAzureUserInput } from '../../index';

export class AzureWizard<T> {
    private readonly _steps: AzureWizardStep<T>[];
    private _wizardContext: T;

    public constructor(steps: AzureWizardStep<T>[], wizardContext: T) {
        this._steps = steps;
        this._wizardContext = wizardContext;
    }

    public async prompt(actionContext: IActionContext, ui: IAzureUserInput): Promise<T> {
        for (const step of this._steps) {
            actionContext.properties.lastStepAttempted = `prompt-${step.constructor.name}`;
            this._wizardContext = await step.prompt(this._wizardContext, ui);
        }

        return this._wizardContext;
    }

    public async execute(actionContext: IActionContext, outputChannel: OutputChannel): Promise<T> {
        outputChannel.show(true);
        for (const step of this._steps) {
            actionContext.properties.lastStepAttempted = `execute-${step.constructor.name}`;
            this._wizardContext = await step.execute(this._wizardContext, outputChannel);
        }

        return this._wizardContext;
    }
}
