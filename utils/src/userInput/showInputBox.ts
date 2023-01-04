/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, InputBox, QuickInputButton, QuickInputButtons, window } from 'vscode';
import * as types from '../../index';
import { AzExtQuickInputButtons } from '../constants';
import { GoBackError, UserCancelledError } from '../errors';
import { validOnTimeoutOrException } from '../utils/inputValidation';
import { nonNullProp } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { IInternalActionContext } from './IInternalActionContext';

export async function showInputBox(context: IInternalActionContext, options: types.AzExtInputBoxOptions): Promise<string> {
    const disposables: Disposable[] = [];
    try {
        const inputBox: InputBox = createInputBox(context, options);
        disposables.push(inputBox);

        let latestValidateInputTask: Promise<string | undefined | null> = options.validateInput ? Promise.resolve(options.validateInput(inputBox.value)) : Promise.resolve('');
        let latestAsyncValidationTask: Promise<string | undefined | null> = Promise.resolve('');
        return await new Promise<string>((resolve, reject): void => {
            disposables.push(
                inputBox.onDidChangeValue(async text => {
                    let validateInputTask: Promise<string | undefined | null> | undefined;
                    if (options.validateInput) {
                        validateInputTask = Promise.resolve(options.validateInput(text));
                        latestValidateInputTask = validateInputTask;
                        const message: string | undefined | null = await validateInputTask;
                        if (validateInputTask === latestValidateInputTask) {
                            inputBox.validationMessage = message || '';
                        }
                    }
                    if (options.asyncValidationTask && !inputBox.validationMessage && validateInputTask === latestValidateInputTask) {
                        // Start loading the promise, but wrap with a short debounce to avoid performing server calls too frequently
                        latestAsyncValidationTask = inputBoxDebounce(options.asyncValidationTask, text);
                    }
                }),
                inputBox.onDidAccept(async () => {
                    // Run final validation and resolve if value passes
                    inputBox.enabled = false;
                    inputBox.busy = true;

                    const validateInputResult: string | undefined | null = await latestValidateInputTask;
                    const asyncValidationResult: string | undefined | null = await latestAsyncValidationTask;
                    if (!validateInputResult && !asyncValidationResult) {
                        resolve(inputBox.value);
                    } else if (validateInputResult) {
                        inputBox.validationMessage = validateInputResult;
                    } else if (asyncValidationResult) {
                        inputBox.validationMessage = asyncValidationResult;
                    }

                    inputBox.enabled = true;
                    inputBox.busy = false;
                }),
                inputBox.onDidTriggerButton(async btn => {
                    if (btn === QuickInputButtons.Back) {
                        reject(new GoBackError());
                    } else if (btn === AzExtQuickInputButtons.LearnMore) {
                        await openUrl(nonNullProp(options, 'learnMoreLink'));
                        context.telemetry.properties.learnMoreStep = context.telemetry.properties.lastStep;
                    }
                }),
                inputBox.onDidHide(() => {
                    reject(new UserCancelledError());
                })
            );
            inputBox.show();
        });
    } finally {
        disposables.forEach(d => { d.dispose(); });
    }
}

function createInputBox(context: IInternalActionContext, options: types.AzExtInputBoxOptions): InputBox {
    const inputBox: InputBox = window.createInputBox();

    const wizard = context.ui.wizard;
    if (wizard && wizard.showTitle) {
        inputBox.title = wizard.title;
        if (!wizard.hideStepCount && wizard.title) {
            inputBox.step = wizard.currentStep;
            inputBox.totalSteps = wizard.totalSteps;
        }
    }

    const buttons: QuickInputButton[] = [];
    if (wizard?.showBackButton) {
        buttons.push(QuickInputButtons.Back);
    }

    if (options.learnMoreLink) {
        buttons.push(AzExtQuickInputButtons.LearnMore);
    }

    inputBox.buttons = buttons;

    if (options.ignoreFocusOut === undefined) {
        options.ignoreFocusOut = true;
    }

    const validateInput = options.validateInput;
    if (validateInput) {
        options.validateInput = async (v): Promise<string | null | undefined> => validOnTimeoutOrException(async () => await validateInput(v));
    }

    if (!inputBox.password) {
        inputBox.value = wizard?.getCachedInputBoxValue() || options.value || '';
    }

    // Copy settings that are common between options and inputBox
    inputBox.ignoreFocusOut = !!options.ignoreFocusOut;
    inputBox.password = !!options.password;
    inputBox.placeholder = options.placeHolder;
    inputBox.prompt = options.prompt;
    inputBox.title ??= options.title;
    return inputBox;
}

type DisposableLike = {
    dispose: () => unknown,
    cancelPrevious: () => unknown
}
let activeDebounce: DisposableLike | undefined;

export async function inputBoxDebounce(callback: (...args: unknown[]) => Promise<string | undefined | null>, ...args: unknown[]): Promise<string | undefined | null> {
    // Remove active debounce if it already exists
    if (activeDebounce) {
        activeDebounce.cancelPrevious();
        activeDebounce = undefined;
    }

    return new Promise((resolve) => {
        // Schedule the callback
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        const timeout = setTimeout(async () => {
            // Clear the callback since we're about to fire it
            activeDebounce?.dispose();
            activeDebounce = undefined;

            // Fire the callback
            resolve(await callback(...args));
        }, 250);

        // Keep track of the active debounce
        activeDebounce = {
            dispose: () => clearTimeout(timeout),
            cancelPrevious: () => {
                clearTimeout(timeout);
                resolve(undefined);
            }
        };
    })
}
