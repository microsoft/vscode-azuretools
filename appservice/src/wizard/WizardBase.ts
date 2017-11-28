/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Memento, OutputChannel } from 'vscode';
import { UserCancelledError } from 'vscode-azureextensionui';
import { WizardFailedError } from '../errors';
import { WizardStep } from './WizardStep';

export abstract class WizardBase {
    public readonly persistence: Memento;

    private readonly _outputChannel: OutputChannel;
    private readonly _steps: WizardStep[] = [];

    protected constructor(outputChannel: OutputChannel, persistence: Memento) {
        this._outputChannel = outputChannel;
        this.persistence = persistence;
    }

    public async run(): Promise<void> {
        // Go through the prompts...
        for (const step of this._steps) {
            try {
                await step.prompt();
            } catch (err) {
                this.onError(<Error>err, step);
            }
        }

        this._outputChannel.show(true);
        // Execute each step...
        for (const step of this._steps) {
            try {
                await step.execute();
            } catch (err) {
                this.onError(<Error>err, step);
            }
        }
    }

    public writeline(text: string): void {
        this._outputChannel.appendLine(text);
    }

    public get steps(): WizardStep[] {
        return this._steps;
    }

    private onError(err: Error, step: WizardStep): void {
        if (err instanceof UserCancelledError) {
            throw err;
        }

        throw new WizardFailedError(err, step.constructor.name, step.stepIndex);
    }
}
