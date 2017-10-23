/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzureAccountWrapper } from './azureAccountWrapper';
import { SubscriptionModels } from 'azure-arm-resource';
import { UserCancelledError, WizardFailedError } from './errors';

export type WizardStatus = 'PromptCompleted' | 'Completed' | 'Faulted' | 'Cancelled';

export abstract class WizardBase {
    private readonly _steps: WizardStep[] = [];
    private _result: WizardResult;

    protected constructor(readonly output: vscode.OutputChannel) { }

    protected abstract initSteps();

    async run(promptOnly = false): Promise<WizardResult> {
        this.initSteps();

        // Go through the prompts...
        for (var i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];

            try {
                await this.steps[i].prompt();
            } catch (err) {
                this.onError(err, step);
            }
        }

        if (promptOnly) {
            return {
                status: 'PromptCompleted',
                step: this.steps[this.steps.length - 1],
                error: null
            };
        }

        return this.execute();
    }

    async execute(): Promise<WizardResult> {
        // Execute each step...
        this.output.show(true);
        for (var i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];

            try {
                this.beforeExecute(step, i);
                await this.steps[i].execute();
            } catch (err) {
                this.onError(err, step);
            }
        }

        this._result = {
            status: 'Completed',
            step: this.steps[this.steps.length - 1],
            error: null
        };

        return this._result;
    }

    get steps(): WizardStep[] {
        return this._steps;
    }

    findStepOfType<T extends WizardStep>(stepTypeConstructor: { new(...args: any[]): T }, isOptional?: boolean): T {
        return <T>this.findStep(
            step => step instanceof stepTypeConstructor,
            isOptional ? null : `The Wizard should have had a ${stepTypeConstructor.name} step`);
    }

    findStep(predicate: (step: WizardStep) => boolean, errorMessage?: string): WizardStep {
        const step = this.steps.find(predicate);

        if (!step && errorMessage) {
            throw new Error(errorMessage);
        }

        return step;
    }

    write(text: string) {
        this.output.append(text);
    }

    writeline(text: string) {
        this.output.appendLine(text);
    }

    private onError(err: Error, step: WizardStep) {
        if (err instanceof UserCancelledError) {
            throw err;
        }

        this.writeline(`Error: ${err.message}`);
        this.writeline('');
        throw new WizardFailedError(err, step.telemetryStepTitle, step.stepIndex);
    }

    protected abstract beforeExecute(step?: WizardStep, stepIndex?: number);
}

export interface WizardResult {
    status: WizardStatus;
    step: WizardStep;
    error: Error | null;
}

export interface WizardStatePersistence {

}

export class WizardStep {
    protected constructor(readonly wizard: WizardBase, readonly telemetryStepTitle: string, private persistenceState?: vscode.Memento) { }

    async prompt(): Promise<void> { }
    async execute(): Promise<void> { }

    get stepIndex(): number {
        return this.wizard.steps.findIndex(step => step === this);
    }

    get stepProgressText(): string {
        return `Step ${this.stepIndex + 1}/${this.wizard.steps.length}`;
    }

    async showQuickPick<T>(items: QuickPickItemWithData<T>[] | Thenable<QuickPickItemWithData<T>[]>, options: vscode.QuickPickOptions, persistenceKey?: string, token?: vscode.CancellationToken): Promise<QuickPickItemWithData<T>> {
        options.ignoreFocusOut = true;
        var resolvedItems = await items;
        if (this.persistenceState && persistenceKey) {
            // See if the previous value selected by the user is in this list, and move it to the top as default
            var previousId = this.persistenceState.get(persistenceKey);
            var previousItem = previousId && resolvedItems.find(item => item.persistenceId === previousId);
            if (previousItem) {
                resolvedItems = ([previousItem]).concat(resolvedItems.filter(item => item !== previousItem));
            }
        }

        const result = await vscode.window.showQuickPick(resolvedItems, options, token);
        if (!result) {
            throw new UserCancelledError();
        }

        if (this.persistenceState && persistenceKey) {
            this.persistenceState.update(persistenceKey, result.persistenceId);
        }

        return result;
    }

    async showInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken): Promise<string> {
        options.ignoreFocusOut = true;
        const result = await vscode.window.showInputBox(options, token);

        if (!result) {
            throw new UserCancelledError();
        }

        return result;
    }
}

export class SubscriptionStepBase extends WizardStep {
    constructor(wizard: WizardBase, title: string, readonly azureAccount: AzureAccountWrapper, protected _subscription?: SubscriptionModels.Subscription, persistence?: vscode.Memento) {
        super(wizard, title, persistence);
    }

    protected getSubscriptionsAsQuickPickItems(): Promise<QuickPickItemWithData<SubscriptionModels.Subscription>[]> {
        return Promise.resolve(
            this.azureAccount.getFilteredSubscriptions().map(s => {
                return {
                    persistenceId: s.subscriptionId,
                    label: s.displayName,
                    description: '',
                    detail: s.subscriptionId,
                    data: s
                };
            })
        );
    }

    get subscription(): SubscriptionModels.Subscription {
        return this._subscription;
    }
}

export interface QuickPickItemWithData<T> extends vscode.QuickPickItem {
    persistenceId?: string; // A unique key to identify this item items across sessions, used in persisting previous selections
    data?: T;
}
