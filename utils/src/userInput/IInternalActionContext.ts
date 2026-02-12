/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vscode';
import type { IActionContext } from '../types/actionContext';
import type { IAzureUserInput } from '../types/userInput';

export interface IInternalActionContext extends IActionContext {
    ui: IAzureUserInput & { wizard?: IInternalAzureWizard, isPrompting?: boolean, isTesting?: boolean };
}

export interface IInternalAzureWizard {
    title: string | undefined;
    currentStep: number;
    currentStepId: string | undefined;
    totalSteps: number;
    hideStepCount: boolean | undefined;
    showBackButton: boolean;
    showTitle: boolean;
    cancellationToken: CancellationToken;
    getCachedInputBoxValue(): string | undefined;
}
