/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import { ProgressLocation } from 'vscode';
import * as types from '../../index';
import { ExecuteActivity } from '../activityLog/activities/ExecuteActivity';
import { GoBackError, UserCancelledError } from '../errors';
import { localize } from '../localize';
import { parseError } from '../parseError';
import { IInternalActionContext, IInternalAzureWizard } from '../userInput/IInternalActionContext';
import { createQuickPick } from '../userInput/showQuickPick';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';

export class AzureWizard<T extends IInternalActionContext> implements types.AzureWizard<T>, IInternalAzureWizard {
    public title: string | undefined;
    private readonly _promptSteps: AzureWizardPromptStep<T>[];
    private readonly _executeSteps: AzureWizardExecuteStep<T>[];
    private readonly _finishedPromptSteps: AzureWizardPromptStep<T>[] = [];
    private readonly _context: T;
    private _stepHideStepCount?: boolean;
    private _wizardHideStepCount?: boolean;
    private _showLoadingPrompt?: boolean;
    private _cancellationTokenSource: vscode.CancellationTokenSource;

    private _cachedInputBoxValues: { [step: string]: string | undefined } = {};
    public currentStepId: string | undefined;

    public constructor(context: T, options: types.IWizardOptions<T>) {
        // reverse steps to make it easier to use push/pop
        this._promptSteps = (<AzureWizardPromptStep<T>[]>options.promptSteps || []).reverse();
        this._promptSteps.forEach(s => { s.effectiveTitle = options.title; });
        this._executeSteps = options.executeSteps || [];
        this._context = context;
        this._wizardHideStepCount = options.hideStepCount;
        this._showLoadingPrompt = options.showLoadingPrompt;
        this._cancellationTokenSource = new vscode.CancellationTokenSource();
    }

    public getCachedInputBoxValue(): string | undefined {
        return this.currentStepId ? this._cachedInputBoxValues[this.currentStepId] : undefined;
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

    public get showBackButton(): boolean {
        return this.currentStep > 1;
    }

    public get showTitle(): boolean {
        return this.totalSteps > 1;
    }

    public get cancellationToken(): vscode.CancellationToken {
        return this._cancellationTokenSource.token;
    }

    public async prompt(): Promise<void> {
        this._context.ui.wizard = this;

        try {
            let step: AzureWizardPromptStep<T> | undefined = this._promptSteps.pop();
            while (step) {
                if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
                    throw new UserCancelledError();
                }

                step.reset();

                this._context.telemetry.properties.lastStep = `prompt-${getEffectiveStepId(step)}`;
                this.title = step.effectiveTitle;
                this._stepHideStepCount = step.hideStepCount;

                if (step.shouldPrompt(this._context)) {
                    step.propertiesBeforePrompt = Object.keys(this._context).filter(k => !isNullOrUndefined(this._context[k]));

                    const loadingQuickPick = this._showLoadingPrompt ? createQuickPick(this._context, {
                        loadingPlaceHolder: localize('loading', 'Loading...')
                    }) : undefined;

                    const disposables: vscode.Disposable[] = [];

                    if (loadingQuickPick) {
                        disposables.push(loadingQuickPick?.onDidHide(() => {
                            if (!this._context.ui.isPrompting) {
                                this._cancellationTokenSource.cancel();
                            }
                        }));
                    }

                    disposables.push(this._context.ui.onDidFinishPrompt((result) => {
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        step!.prompted = true;
                        loadingQuickPick?.show();
                        if (typeof result.value === 'string' && !result.matchesDefault && this.currentStepId && !step?.supportsDuplicateSteps) {
                            this._cachedInputBoxValues[this.currentStepId] = result.value;
                        }
                    }));

                    try {
                        this.currentStepId = getEffectiveStepId(step);
                        loadingQuickPick?.show();
                        await step.prompt(this._context);
                    } catch (err) {
                        const pe: types.IParsedError = parseError(err);
                        if (pe.errorType === 'GoBackError') { // Use `errorType` instead of `instanceof` so that tests can also hit this case
                            step = this.goBack(step);
                            continue;
                        } else {
                            throw err;
                        }
                    } finally {
                        this.currentStepId = undefined;
                        vscode.Disposable.from(...disposables).dispose();
                        loadingQuickPick?.hide();
                    }
                }

                if (step.getSubWizard) {
                    if (this._context.ui.wizard?.cancellationToken.isCancellationRequested) {
                        throw new UserCancelledError();
                    }
                    const subWizard: types.IWizardOptions<T> | void = await step.getSubWizard(this._context);
                    if (subWizard) {
                        this.addSubWizard(step, subWizard);
                    }
                }

                this._finishedPromptSteps.push(step);
                step = this._promptSteps.pop();
            }
        } finally {
            this._context.ui.wizard = undefined;
            this._cancellationTokenSource.dispose();
        }
    }

    public async execute(options: types.AzureWizardExecuteOptions = {}): Promise<void> {
        await this.withProgress(options, { location: ProgressLocation.Notification }, async progress => {
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
                    this._context.telemetry.properties.lastStep = `execute-${getEffectiveStepId(step)}`;
                    await step.execute(this._context, internalProgress);
                    currentStep += 1;
                }
                step = steps.pop();
            }
        });
    }

    private async withProgress(executeOptions: types.AzureWizardExecuteOptions, options: vscode.ProgressOptions, task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<void>): Promise<void> {
        if (executeOptions.activity) {
            const activity = new ExecuteActivity({
                title: executeOptions.activity.name ?? this.title ?? 'Azure operation',
                context: this._context,
            }, async (activityProgress) => {

                await vscode.window.withProgress(options, async (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken): Promise<void> => {

                    const internalProgress: vscode.Progress<{ message?: string; increment?: number }> = {
                        report: (value: { message?: string; increment?: number }): void => {
                            progress.report(value);
                            activityProgress.report(value);
                        }
                    };

                    await task(internalProgress, token);
                });
            });

            await executeOptions.activity.registerActivity(activity);
            await activity.run();

        } else {
            await vscode.window.withProgress(options, task);
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

            if (step.hasSubWizard) {
                removeFromEnd(this._promptSteps, step.numSubPromptSteps);
                removeFromEnd(this._executeSteps, step.numSubExecuteSteps);
            }
        } while (!step.prompted);

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
                return s1.supportsDuplicateSteps || !this._finishedPromptSteps.concat(this._promptSteps).some(s2 => getEffectiveStepId(s1) === getEffectiveStepId(s2));
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

function getEffectiveStepId<T extends IInternalActionContext>(step: types.AzureWizardPromptStep<T> | types.AzureWizardExecuteStep<T>): string {
    return step.id || step.constructor.name;
}

function removeFromEnd<T>(array: T[], n: number): void {
    array.splice(n * -1, n);
}
