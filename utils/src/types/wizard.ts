/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IActionContext } from './actionContext';
import type { AzureWizardPromptStep } from '../wizard/AzureWizardPromptStep';
import type { AzureWizardExecuteStep } from '../wizard/AzureWizardExecuteStep';

export interface IWizardOptions<T extends IActionContext> {
    /**
     * The steps to prompt for user input, in order
     */
    promptSteps?: AzureWizardPromptStep<T>[];

    /**
     * The steps to execute, in order
     */
    executeSteps?: AzureWizardExecuteStep<T>[];

    /**
     * A title used when prompting
     */
    title?: string;

    /**
     * If true, step count will not be displayed for the entire wizard. Defaults to false.
     */
    hideStepCount?: boolean;

    /**
    * If true, a loading prompt will be displayed if there are long delays between wizard steps.
    */
    showLoadingPrompt?: boolean;

    /**
     * If true, all execute steps will be removed, and instead a single execute step will be added that throws a UserCancelledError.
     * Additionally, any execute activity context properties will be replaced with one which avoids having activities show up in the Azure output
     * window.
     */
    skipExecute?: boolean;
}

export interface AzureWizardExecuteStepOptions {
    /**
     * Used to indicate whether any `ExecuteActivityOutput` properties should be suppressed from display
     */
    suppressActivityOutput?: import('../wizard/AzureWizard').ActivityOutputType;
    /**
     * If enabled, the Azure Wizard will continue running and swallow any errors thrown during step execution
     */
    continueOnFail?: boolean;
}

export type ConfirmationViewProperty = {
    /**
     *  A displayable name of the step
     */
    name: string;
    /**
     * A displayable value chosen by the user (The label of the chosen value for the step)
     */
    value: string;
    /**
     * The name which can be used to access the value in the wizard context
     */
    contextPropertyName: string;
};

export interface IConfirmInputOptions {
    prompt?: string;
    isPassword?: boolean;
}

export interface IAzureNamingRules {
    minLength: number;
    maxLength: number;

    /**
     * A RegExp specifying the invalid characters.
     * For example, /[^a-z0-9]/ would specify that only lowercase, alphanumeric characters are allowed.
     */
    invalidCharsRegExp: RegExp;

    /**
     * Specify this if only lowercase letters are allowed
     * This is a separate property than `invalidCharsRegExp` because the behavior can be different.
     * For example, when generating a relatedName, we can convert uppercase letters to lowercase instead of just removing them.
     */
    lowercaseOnly?: boolean;
}

export interface IRelatedNameWizardContext extends IActionContext {
    /**
     * A task that evaluates to the related name that should be used as the default for other new resources or undefined if a unique name could not be found
     * The task will be defined after `AzureNameStep.prompt` occurs.
     */
    relatedNameTask?: Promise<string | undefined>;
}
