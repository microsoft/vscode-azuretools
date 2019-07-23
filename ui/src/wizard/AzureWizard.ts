/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import * as types from '../../index';
import { GoBackError } from '../errors';
import { ext, IRootUserInput } from '../extensionVariables';
import { parseError } from '../parseError';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { AzureWizardUserInput, IInternalAzureWizard } from './AzureWizardUserInput';

export class AzureWizard<T extends types.IActionContext> implements types.AzureWizard<T>, IInternalAzureWizard {
    public title: string | undefined;
    private readonly _promptSteps: AzureWizardPromptStep<T>[];
    private readonly _executeSteps: AzureWizardExecuteStep<T>[];
    private readonly _finishedPromptSteps: AzureWizardPromptStep<T>[] = [];
    private readonly _context: T;
    private _stepHideStepCount?: boolean;
    private _wizardHideStepCount?: boolean;

    public constructor(context: T, options: types.IWizardOptions<T>) {
        // reverse steps to make it easier to use push/pop
        // tslint:disable-next-line: strict-boolean-expressions
        this._promptSteps = (<AzureWizardPromptStep<T>[]>options.promptSteps || []).reverse();
        this._promptSteps.forEach(s => { s.effectiveTitle = options.title; });
        // tslint:disable-next-line: strict-boolean-expressions
        this._executeSteps = options.executeSteps || [];
        this._context = context;
        this._wizardHideStepCount = options.hideStepCount;
    }

    public get hideStepCount(): boolean {
        return !!(this._wizardHideStepCount || this._stepHideStepCount);
    }

    public get currentStep(): number {
        return this._finishedPromptSteps.filter(s => s.prompted).length + 1;
    }

    public get totalSteps(): number {
        return this._finishedPromptSteps.filter(s => s.prompted).length + this._promptSteps.filter(s => s.shouldPrompt(this._context)).length + 1;
    }

    public async prompt(): Promise<void> {
        // Insert Wizard UI into ext.ui.rootUserInput - to be used instead of vscode.window UI
        const oldRootUserInput: IRootUserInput | undefined = ext.ui.rootUserInput;
        ext.ui.rootUserInput = new AzureWizardUserInput(this);

        try {
            let step: AzureWizardPromptStep<T> | undefined = this._promptSteps.pop();
            while (step) {
                step.reset();

                this._context.telemetry.properties.lastStepAttempted = `prompt-${step.constructor.name}`;
                this.title = step.effectiveTitle;
                this._stepHideStepCount = step.hideStepCount;

                if (step.shouldPrompt(this._context)) {
                    step.propertiesBeforePrompt = Object.keys(this._context).filter(k => !isNullOrUndefined(this._context[k]));

                    try {
                        await step.prompt(this._context);
                        step.prompted = true;
                    } catch (err) {
                        if (parseError(err).errorType === 'GoBackError') { // Use `errorType` instead of `instanceof` so that tests can also hit this case
                            this._context.telemetry.properties.usedBackButton = 'true';
                            step = this.goBack(step);
                            continue;
                        } else {
                            throw err;
                        }
                    }
                }

                if (step.getSubWizard) {
                    const subWizard: types.IWizardOptions<T> | void = await step.getSubWizard(this._context);
                    if (subWizard) {
                        this.addSubWizard(step, subWizard);
                    }
                }

                this._finishedPromptSteps.push(step);
                step = this._promptSteps.pop();
            }
        } finally {
            ext.ui.rootUserInput = oldRootUserInput;
        }
    }

    public async execute(): Promise<void> {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async progress => {
            let currentStep: number = 1;

            const steps: AzureWizardExecuteStep<T>[] = this._executeSteps.sort((a, b) => b.priority - a.priority);

            const internalProgress: vscode.Progress<{ message?: string; increment?: number }> = {
                report: (value: { message?: string; increment?: number }): void => {
                    if (value.message) {
                        const totalSteps: number = currentStep + steps.filter(s => s.shouldExecute(this._context)).length;
                        if (totalSteps > 1) {
                            value.message += ` (${currentStep}/${totalSteps})`;
                        }
                    }
                    progress.report(value);
                }
            };

            let step: AzureWizardExecuteStep<T> | undefined = steps.pop();
            while (step) {
                if (step.shouldExecute(this._context)) {
                    this._context.telemetry.properties.lastStepAttempted = `execute-${step.constructor.name}`;
                    await step.execute(this._context, internalProgress);
                    currentStep += 1;
                }

                step = steps.pop();
            }
        });
    }

    private goBack(currentStep: AzureWizardPromptStep<T>): AzureWizardPromptStep<T> {
        let step: AzureWizardPromptStep<T> | undefined = currentStep;
        do {
            this._promptSteps.push(step);
            step = this._finishedPromptSteps.pop();
            if (!step) {
                throw new GoBackError();
            }
        } while (!step.prompted);

        if (step.hasSubWizard) {
            removeFromEnd(this._promptSteps, step.numSubPromptSteps);
            removeFromEnd(this._executeSteps, step.numSubExecuteSteps);
        }

        for (const key of Object.keys(this._context)) {
            if (!step.propertiesBeforePrompt.find(p => p === key)) {
                this._context[key] = undefined;
            }
        }

        return step;
    }

    private addSubWizard(step: AzureWizardPromptStep<T>, subWizard: types.IWizardOptions<T>): void {
        step.hasSubWizard = true;

        if (subWizard.promptSteps) {
            subWizard.promptSteps = subWizard.promptSteps.filter(s1 => {
                return !this._finishedPromptSteps.concat(this._promptSteps).some(s2 => s1.constructor.name === s2.constructor.name);
            });
            this._promptSteps.push(...<AzureWizardPromptStep<T>[]>subWizard.promptSteps.reverse());
            step.numSubPromptSteps = subWizard.promptSteps.length;

            subWizard.promptSteps.forEach(s => { (<AzureWizardPromptStep<T>>s).effectiveTitle = subWizard.title || step.effectiveTitle; });
        }

        if (subWizard.executeSteps) {
            this._executeSteps.push(...subWizard.executeSteps);
            step.numSubExecuteSteps = subWizard.executeSteps.length;
        }
    }
}

function removeFromEnd<T>(array: T[], n: number): void {
    array.splice(n * -1, n);
}
