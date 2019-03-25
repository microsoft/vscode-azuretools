/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../../index';
import { IWizardNode } from './IWizardNode';

export abstract class AzureWizardPromptStep<T> implements types.AzureWizardPromptStep<T> {
    public hideStepCount: boolean = false;
    public hasSubWizard: boolean;
    public numSubPromptSteps: number;
    public wizardNode: IWizardNode<T>;
    public propertiesBeforePrompt: string[];
    public prompted: boolean;

    public abstract prompt(wizardContext: T): Promise<void>;

    public getSubWizard?(wizardContext: T): Promise<types.IWizardOptions<T> | undefined>;

    public abstract shouldPrompt(wizardContext: T): boolean;

    public reset(): void {
        this.hasSubWizard = false;
        this.numSubPromptSteps = 0;
        this.prompted = false;
    }
}
