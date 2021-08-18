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

        let latestValidation: Promise<string | undefined | null> = options.validateInput ? Promise.resolve(options.validateInput(inputBox.value)) : Promise.resolve('');
        return await new Promise<string>((resolve, reject): void => {
            disposables.push(
                inputBox.onDidChangeValue(async text => {
                    if (options.validateInput) {
                        const validation: Promise<string | undefined | null> = Promise.resolve(options.validateInput(text));
                        latestValidation = validation;
                        const message: string | undefined | null = await validation;
                        if (validation === latestValidation) {
                            inputBox.validationMessage = message || '';
                        }
                    }
                }),
                inputBox.onDidAccept(async () => {
                    // Run final validation and resolve if value passes
                    inputBox.enabled = false;
                    inputBox.busy = true;
                    const message: string | undefined | null = await latestValidation;
                    if (!message) {
                        resolve(inputBox.value);
                    } else {
                        inputBox.validationMessage = message;
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
    return inputBox;
}
