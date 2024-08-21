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
import { ext } from '../extensionVariables';
import { parseError } from '../parseError';
import { IInternalActionContext, IInternalAzureWizard } from '../userInput/IInternalActionContext';
import { createQuickPick } from '../userInput/showQuickPick';
import { AzureWizardExecuteStep } from './AzureWizardExecuteStep';
import { AzureWizardPromptStep } from './AzureWizardPromptStep';
import { NoExecuteStep } from './NoExecuteStep';
import { getSilentExecuteActivityContext } from './SilentExecuteActivityContext';

export enum ActivityOutputType {
    Item = 'item',
    Message = 'message',
    All = 'all',
}

export class AzureWizard<T extends (IInternalActionContext & Partial<types.ExecuteActivityContext>)> implements types.AzureWizard<T>, IInternalAzureWizard {
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

        if (options.skipExecute === true) {
            this._executeSteps.splice(0);
            this._executeSteps.push(new NoExecuteStep());
            this._context = { ...this._context, ...getSilentExecuteActivityContext() };
        }
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

                step.propertiesBeforePrompt = Object.keys(this._context).filter(k => !isNullOrUndefined(this._context[k]));

                if (step.configureBeforePrompt) {
                    await step.configureBeforePrompt(this._context);
                }

                if (step.shouldPrompt(this._context)) {
                    const loadingQuickPick = this._showLoadingPrompt ? createQuickPick(this._context, {
                        loadingPlaceHolder: vscode.l10n.t('Loading...')
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

    public async execute(): Promise<void> {
        await this.withProgress({ location: ProgressLocation.Notification }, async progress => {
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
                if (!step.shouldExecute(this._context)) {
                    step = steps.pop();
                    continue;
                }

                let output: types.ExecuteActivityOutput | undefined;
                const progressOutput: types.ExecuteActivityOutput | undefined = step.createProgressOutput?.(this._context);
                if (progressOutput) {
                    this.displayActivityOutput(progressOutput, step.options);
                }

                try {
                    this._context.telemetry.properties.lastStep = `execute-${getEffectiveStepId(step)}`;
                    await step.execute(this._context, internalProgress);
                    output = step.createSuccessOutput?.(this._context);
                } catch (e) {
                    output = step.createFailOutput?.(this._context);
                    if (!step.options.continueOnFail) {
                        throw e;
                    }
                } finally {
                    output ??= {};

                    // always remove the progress item from the activity log
                    if (progressOutput?.item) {
                        this._context.activityChildren = this._context.activityChildren?.filter(t => t !== progressOutput.item);
                    }

                    this.displayActivityOutput(output, step.options);

                    currentStep += 1;
                    step = steps.pop();
                }
            }
        });
    }

    private displayActivityOutput(output: types.ExecuteActivityOutput, options: types.AzureWizardExecuteStepOptions): void {
        if (output.item &&
            options.suppressActivityOutput !== ActivityOutputType.Item &&
            options.suppressActivityOutput !== ActivityOutputType.All
        ) {
            this._context.activityChildren?.push(output.item);
        }

        if (output.message &&
            options.suppressActivityOutput !== ActivityOutputType.Message &&
            options.suppressActivityOutput !== ActivityOutputType.All
        ) {
            ext.outputChannel?.appendLog(output.message);
        }
    }

    private async withProgress(options: vscode.ProgressOptions, task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<void>): Promise<void> {
        if (this._context.registerActivity) {
            this._context.activityTitle ??= this.title;

            const WizardActivity = this._context.wizardActivity ?? ExecuteActivity;

            const activity = new WizardActivity(
                this._context as types.ExecuteActivityContext,
                async (activityProgress) => {
                    if (this._context.suppressNotification) {
                        await task(activityProgress, activity.cancellationTokenSource.token);
                    } else {
                        await vscode.window.withProgress(options, async (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken): Promise<void> => {
                            token.onCancellationRequested(() => {
                                activity.cancellationTokenSource.cancel();
                            });

                            const internalProgress: vscode.Progress<{ message?: string; increment?: number }> = {
                                report: (value: { message?: string; increment?: number }): void => {
                                    progress.report(value);
                                    activityProgress.report(value);
                                }
                            };

                            await task(internalProgress, token);
                        });
                    }
                });

            await this._context.registerActivity(activity);
            await activity.run();

        } else {
            if (this._context.suppressNotification) {
                const internalProgress = { report: (): void => { return; } };
                await task(internalProgress, this._cancellationTokenSource.token);
            } else {
                await vscode.window.withProgress(options, task);
            }
        }
    }

    private goBack(currentStep: AzureWizardPromptStep<T>): AzureWizardPromptStep<T> {
        let step: AzureWizardPromptStep<T> | undefined = currentStep;
        do {
            this._promptSteps.push(step);
            step = this._finishedPromptSteps.pop();
            step?.undo?.(this._context);
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
