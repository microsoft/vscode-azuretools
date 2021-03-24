/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';

export abstract class AzureWizardPromptStep<T extends types.IActionContext> implements types.AzureWizardPromptStep<T> {
    public hideStepCount: boolean = false;
    public supportsDuplicateSteps: boolean = false;
    public effectiveTitle: string | undefined;
    public hasSubWizard: boolean;
    public numSubPromptSteps: number;
    public numSubExecuteSteps: number;
    public propertiesBeforePrompt: string[];
    public prompted: boolean;
    public id?: string;

    public abstract prompt(wizardContext: T): Promise<void>;

    public getSubWizard?(wizardContext: T): Promise<types.IWizardOptions<T> | undefined>;

    public abstract shouldPrompt(wizardContext: T): boolean;

    public reset(): void {
        this.hasSubWizard = false;
        this.numSubPromptSteps = 0;
        this.numSubExecuteSteps = 0;
        this.prompted = false;
    }
}
