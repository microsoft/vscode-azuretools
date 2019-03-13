/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import * as types from '../../index';
import { AzureUserInput, IRootUserInput } from '../AzureUserInput';
import { GoBackError } from '../errors';
import { ext } from '../extensionVariables';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { AzureWizardUserInput, IInternalAzureWizard } from './AzureWizardUserInput';

export class AzureWizard<T> implements types.AzureWizard<T>, IInternalAzureWizard {
    public readonly title: string;
    private readonly _showExecuteProgress?: boolean;
    private readonly _promptSteps: AzureWizardPromptStep<T>[];
    private readonly _executeSteps: AzureWizardExecuteStep<T>[];
    private readonly _subExecuteSteps: AzureWizardExecuteStep<T>[] = [];
    private readonly _finishedPromptSteps: AzureWizardPromptStep<T>[] = [];
    private readonly _wizardContext: T;

    public constructor(wizardContext: T, options: types.IWizardOptions<T>) {
        // reverse steps to make it easier to use push/pop
        this._promptSteps = <AzureWizardPromptStep<T>[]>options.promptSteps.reverse();
        this._executeSteps = options.executeSteps ? options.executeSteps.reverse() : [];
        this._wizardContext = wizardContext;
        this.title = options.title;
        this._showExecuteProgress = options.showExecuteProgress;
    }

    public get currentStep(): number {
        return this._finishedPromptSteps.length + 1;
    }

    public get totalSteps(): number {
        return this._finishedPromptSteps.length + this._promptSteps.filter(s => s.shouldPrompt(this._wizardContext)).length + 1;
    }

    public async prompt(actionContext: types.IActionContext): Promise<void> {
        // Insert Wizard UI into ext.ui.rootUserInput - to be used instead of vscode.window UI
        let oldRootUserInput: IRootUserInput = vscode.window;
        if (ext.ui instanceof AzureUserInput) {
            oldRootUserInput = ext.ui.rootUserInput;
            ext.ui.rootUserInput = new AzureWizardUserInput(this);
        }

        try {
            let step: AzureWizardPromptStep<T> | undefined = this._promptSteps.pop();
            while (step) {
                if (step.shouldPrompt(this._wizardContext)) {
                    actionContext.properties.lastStepAttempted = `prompt-${step.constructor.name}`;
                    step.propertiesBeforePrompt = Object.keys(this._wizardContext).filter(k => !isNullOrUndefined(this._wizardContext[k]));

                    try {
                        const subWizard: types.ISubWizardOptions<T> | void = await step.prompt(this._wizardContext);
                        this._finishedPromptSteps.push(step);
                        if (subWizard) {
                            this.addSubWizard(step, subWizard);
                        }
                    } catch (err) {
                        if (err instanceof GoBackError) {
                            this._promptSteps.push(step);
                            step = this.goBack();
                            continue;
                        } else {
                            throw err;
                        }
                    }
                }

                step = this._promptSteps.pop();
            }
        } finally {
            if (ext.ui instanceof AzureUserInput) {
                ext.ui.rootUserInput = oldRootUserInput;
            }
        }
    }

    public async execute(actionContext: types.IActionContext): Promise<void> {
        if (this._showExecuteProgress) {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async progress => {
                await this.executeCore(actionContext, progress);
            });
        } else {
            await this.executeCore(actionContext, { report: (): void => { /* ignore */ } });
        }
    }

    private async executeCore(actionContext: types.IActionContext, progress: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
        let currentStep: number = 1;

        const steps: AzureWizardExecuteStep<T>[] = this._executeSteps.concat(this._subExecuteSteps);

        const internalProgress: vscode.Progress<{ message?: string; increment?: number }> = {
            report: (value: { message?: string; increment?: number }): void => {
                if (value.message) {
                    const totalSteps: number = currentStep + steps.filter(s => s.shouldExecute(this._wizardContext)).length;
                    value.message += ` (${currentStep}/${totalSteps})`;
                }
                progress.report(value);
            }
        };

        let step: AzureWizardExecuteStep<T> | undefined = steps.pop();
        while (step) {
            if (step.shouldExecute(this._wizardContext)) {
                actionContext.properties.lastStepAttempted = `execute-${step.constructor.name}`;
                await step.execute(this._wizardContext, internalProgress);
                currentStep += 1;
            }

            step = steps.pop();
        }
    }

    private goBack(): AzureWizardPromptStep<T> {
        const step: AzureWizardPromptStep<T> | undefined = this._finishedPromptSteps.pop();
        if (!step) {
            throw new GoBackError();
        }

        removeFromEnd(this._promptSteps, step.numSubPromptSteps);
        removeFromEnd(this._subExecuteSteps, step.numSubExecuteSteps);

        step.numSubPromptSteps = 0;
        step.numSubExecuteSteps = 0;

        for (const key of Object.keys(this._wizardContext)) {
            if (!step.propertiesBeforePrompt.find(p => p === key)) {
                this._wizardContext[key] = undefined;
            }
        }

        return step;
    }

    private addSubWizard(step: AzureWizardPromptStep<T>, subWizard: types.ISubWizardOptions<T>): void {
        subWizard.promptSteps = subWizard.promptSteps.filter(s1 => {
            return !this._finishedPromptSteps.concat(this._promptSteps).some(s2 => s1.constructor.name === s2.constructor.name);
        });
        this._promptSteps.push(...<AzureWizardPromptStep<T>[]>subWizard.promptSteps.reverse());
        step.numSubPromptSteps = subWizard.promptSteps.length;

        if (subWizard.executeSteps) {
            subWizard.executeSteps = subWizard.executeSteps.filter(s1 => {
                return !this._subExecuteSteps.concat(this._executeSteps).some(s2 => s1.constructor.name === s2.constructor.name);
            });
            this._subExecuteSteps.unshift(...subWizard.executeSteps.reverse());
            step.numSubExecuteSteps = subWizard.executeSteps.length;
        }
    }
}

function removeFromEnd<T>(array: T[], n: number): void {
    array.splice(n * -1, n);
}
