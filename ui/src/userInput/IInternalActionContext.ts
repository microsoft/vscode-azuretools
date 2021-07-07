/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';

export interface IInternalActionContext extends types.IActionContext {
    ui: types.IAzureUserInput & { wizard?: IInternalAzureWizard }
}

export interface IInternalAzureWizard {
    title: string | undefined;
    currentStep: number;
    totalSteps: number;
    hideStepCount: boolean | undefined;
    showBackButton: boolean;
    showTitle: boolean;
    getCachedInputBoxValue(): string | undefined;
}
