/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import * as types from '../../index';
import { GoBackError } from '../errors';
import { ext, IRootUserInput } from '../extensionVariables';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { AzureWizardUserInput, IInternalAzureWizard } from './AzureWizardUserInput';
import { getExecuteSteps, IWizardNode } from './IWizardNode';

export class AzureWizard<T> implements types.AzureWizard<T>, IInternalAzureWizard {
    public readonly title: string;
    private readonly _showExecuteProgress?: boolean;
    private readonly _promptSteps: AzureWizardPromptStep<T>[];
    private readonly _wizardNode: IWizardNode<T>;
    private readonly _finishedPromptSteps: AzureWizardPromptStep<T>[] = [];
    private readonly _wizardContext: T;

    public constructor(wizardContext: T, options: types.IWizardOptions<T>) {
        // reverse steps to make it easier to use push/pop
        this._promptSteps = <AzureWizardPromptStep<T>[]>options.promptSteps.reverse();
        this._wizardNode = this.initWizardNode(options);
        this._wizardContext = wizardContext;
        this.title = options.title;
        this._showExecuteProgress = options.showExecuteProgress;
    }

    public get currentStep(): number {
        return this._finishedPromptSteps.filter(s => s.prompted).length + 1;
    }

    public get totalSteps(): number {
        return this._finishedPromptSteps.filter(s => s.prompted).length + this._promptSteps.filter(s => s.shouldPrompt(this._wizardContext)).length + 1;
    }

    public async prompt(actionContext: types.IActionContext): Promise<void> {
        // Insert Wizard UI into ext.ui.rootUserInput - to be used instead of vscode.window UI
        const oldRootUserInput: IRootUserInput | undefined = ext.ui.rootUserInput;
        ext.ui.rootUserInput = new AzureWizardUserInput(this);

        try {
            let step: AzureWizardPromptStep<T> | undefined = this._promptSteps.pop();
            while (step) {
                step.reset();

                if (step.shouldPrompt(this._wizardContext)) {
                    actionContext.properties.lastStepAttempted = `prompt-${step.constructor.name}`;
                    step.propertiesBeforePrompt = Object.keys(this._wizardContext).filter(k => !isNullOrUndefined(this._wizardContext[k]));

                    try {
                        const subWizard: types.ISubWizardOptions<T> | void = await step.prompt(this._wizardContext);
                        step.prompted = true;
                        if (subWizard) {
                            this.addSubWizard(step, subWizard);
                        }
                    } catch (err) {
                        if (err instanceof GoBackError) {
                            step = this.goBack(step);
                            continue;
                        } else {
                            throw err;
                        }
                    }
                }

                this._finishedPromptSteps.push(step);
                step = this._promptSteps.pop();
            }
        } finally {
            ext.ui.rootUserInput = oldRootUserInput;
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

        const steps: AzureWizardExecuteStep<T>[] = getExecuteSteps(this._wizardNode);

        const internalProgress: vscode.Progress<{ message?: string; increment?: number }> = {
            report: (value: { message?: string; increment?: number }): void => {
                if (value.message) {
                    const totalSteps: number = steps.filter(s => s.shouldExecute(this._wizardContext)).length;
                    value.message += ` (${currentStep}/${totalSteps})`;
                }
                progress.report(value);
            }
        };

        for (const step of steps) {
            if (step.shouldExecute(this._wizardContext)) {
                actionContext.properties.lastStepAttempted = `execute-${step.constructor.name}`;
                await step.execute(this._wizardContext, internalProgress);
                currentStep += 1;
            }
        }
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
            step.wizardNode.children.pop();
        }

        for (const key of Object.keys(this._wizardContext)) {
            if (!step.propertiesBeforePrompt.find(p => p === key)) {
                this._wizardContext[key] = undefined;
            }
        }

        return step;
    }

    private addSubWizard(step: AzureWizardPromptStep<T>, subWizard: types.ISubWizardOptions<T>): void {
        step.hasSubWizard = true;

        subWizard.promptSteps = subWizard.promptSteps.filter(s1 => {
            return !this._finishedPromptSteps.concat(this._promptSteps).some(s2 => s1.constructor.name === s2.constructor.name);
        });
        this._promptSteps.push(...<AzureWizardPromptStep<T>[]>subWizard.promptSteps.reverse());
        step.numSubPromptSteps = subWizard.promptSteps.length;

        step.wizardNode.children.push(this.initWizardNode(subWizard));
    }

    private initWizardNode(options: types.ISubWizardOptions<T>): IWizardNode<T> {
        // tslint:disable-next-line: strict-boolean-expressions
        const wizardNode: IWizardNode<T> = { executeSteps: options.executeSteps || [], children: [] };
        options.promptSteps.forEach(step => { (<AzureWizardPromptStep<T>>step).wizardNode = wizardNode; });
        return wizardNode;
    }
}

function removeFromEnd<T>(array: T[], n: number): void {
    array.splice(n * -1, n);
}
