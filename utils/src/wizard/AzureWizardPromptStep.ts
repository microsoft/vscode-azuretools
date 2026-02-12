/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IActionContext } from '../types/actionContext';
import type { ConfirmationViewProperty, IWizardOptions } from '../types/wizard';
import { crypto } from '../node/crypto';

export abstract class AzureWizardPromptStep<T extends IActionContext> {
    public hideStepCount: boolean = false;
    public supportsDuplicateSteps: boolean = false;
    public effectiveTitle: string | undefined;
    public hasSubWizard!: boolean;
    public numSubPromptSteps!: number;
    public numSubExecuteSteps!: number;
    public propertiesBeforePrompt!: string[];
    public prompted!: boolean;
    public id: string;

    constructor() {
        this.id = crypto.randomUUID();
    }

    public abstract prompt(wizardContext: T): Promise<void>;

    public getSubWizard?(wizardContext: T): Promise<IWizardOptions<T> | undefined>;
    public undo?(wizardContext: T): void;

    public configureBeforePrompt?(wizardContext: T): void | Promise<void>;
    public confirmationViewProperty?(wizardContext: T): ConfirmationViewProperty
    public abstract shouldPrompt(wizardContext: T): boolean;

    public reset(): void {
        this.hasSubWizard = false;
        this.numSubPromptSteps = 0;
        this.numSubExecuteSteps = 0;
        this.prompted = false;
    }
}
