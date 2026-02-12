/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken, Event, LanguageModelToolInvocationOptions, LanguageModelToolInvocationPrepareOptions, LanguageModelToolResult, MessageItem, PreparedToolInvocation, ProviderResult, QuickPickItem, Uri, WorkspaceFolder } from 'vscode';
import type { IAzureQuickPickOptions, IAzureMessageOptions, AzExtInputBoxOptions, AzExtOpenDialogOptions, AzExtWorkspaceFolderPickOptions, PromptResult } from './userInput';
import type { IActionContext } from './actionContext';

export type ParameterAgentMetadata = {
    /**
     * A title cased string for the parameter this quick pick is for. Will be displayed to the user.
     *
     * For example:
     * - "Subscription"
     * - "Resource Group"
     * - "Runtime"
     * - "Name"
     */
    parameterDisplayTitle: string;

    /**
     * A description of the parameter this quick pick is for. Will be displayed to the user.
     *
     * For example:
     * - "The subscription that the Storage Account should be created in."
     * - "The resource group that the Container App should be created in."
     * - "The function runtime for the Function App."
     * - "The name of the Static Web App."
     */
    parameterDisplayDescription: string;
};

export type AgentQuickPickItem<T extends QuickPickItem = QuickPickItem> = {
    agentMetadata: {
        /**
         * If this quick pick item should not be picked by the agent.
         *
         * @example If an item is a web link which is provided so a user can read some information about the quick pick/items in the quick pick, this
         * is not something the agent would pick.
         */
        notApplicableToAgentPick?: boolean;

        /**
         * If this quick pick item can be used by the agent as a sort of "default" value in order to skip answering the pick quick
         * pick prompt this item is associated with. This is useful for quick picks that don't have any dependents, as the
         * agent can avoid getting stuck trying to answer them. Once the user chooses to go with the parameters that the agent
         * has picked, they will be asked to pick an item for the pick quick pick prompt this item is associated with.
         *
         * For quick picks, the "skip" decision is on an item, unlike how there is {@link AgentInputBoxOptions.skipValue}, because ultimately
         * to "skip" a quick pick, the agent still has to pick an item.
         *
         * @example If what subscription is picked when creating a storage account doesn't matter, then the "create storage account" wizard
         * can choose an arbitrary subscription for the agent to use as a default value for the "pick a subscription" prompt. This allows
         * the agent to move onto more important prompts like the "choose a storage account type" prompt.
         */
        useAsSkipValue?: boolean;
    };
} & T;

export type AgentQuickPickOptions<T extends IAzureQuickPickOptions = IAzureQuickPickOptions> = { agentMetadata: ParameterAgentMetadata; } & T;

export type AgentInputBoxOptions<T extends AzExtInputBoxOptions = AzExtInputBoxOptions> = {
    agentMetadata: ParameterAgentMetadata & {
        /**
         * A value that the agent can use as a sort of "default" value in order to skip answering the input box prompt this options object is
         * associated with. This is useful for input boxes that don't have any dependents, as the agent can avoid getting stuck trying to answer
         * them. Once the user chooses to go with the parameters that the agent has picked, they will be asked to input a value for the input box
         * prompt this options object is associated with.
         */
        skipValue?: string;
    }
} & T;

/**
 * An interface compatible with {@link IAzureUserInput} that allows for the use of an agent to answer prompts instead of showing prompts to the user. Wizards/wizard steps
 * for commands that are exposed to an agent should use this interface to make sure that in the case of an agent being the one to answer prompts, that all necessary
 * information is provided to the agent in order to answer the prompts.
 */
export interface IAzureAgentInput {
    readonly onDidFinishPrompt: Event<PromptResult>;
    showQuickPick<ItemsBaseT extends QuickPickItem, OptionsBaseT extends IAzureQuickPickOptions>(items: AgentQuickPickItem<ItemsBaseT>[] | Promise<AgentQuickPickItem<ItemsBaseT>[]>, options: AgentQuickPickOptions<OptionsBaseT> & { canPickMany: true }): Promise<AgentQuickPickItem<ItemsBaseT>[]>;
    showQuickPick<ItemsBaseT extends QuickPickItem, OptionsBaseT extends IAzureQuickPickOptions>(items: AgentQuickPickItem<ItemsBaseT>[] | Promise<AgentQuickPickItem<ItemsBaseT>[]>, options: AgentQuickPickOptions<OptionsBaseT>): Promise<AgentQuickPickItem<ItemsBaseT>>;
    showInputBox<OptionsBaseT extends IAzureQuickPickOptions>(options: AgentInputBoxOptions<OptionsBaseT>): Promise<string>;

    showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    showWarningMessage<T extends MessageItem>(message: string, options: IAzureMessageOptions, ...items: T[]): Promise<T>;
    showOpenDialog(options: AzExtOpenDialogOptions): Promise<Uri[]>;
    showWorkspaceFolderPick(options: AzExtWorkspaceFolderPickOptions): Promise<WorkspaceFolder>;
}

export type BaseCommandConfig = {
    /**
     * A camel cased string that names the command.
     * @example "createNewFunctionProject"
     */
    name: string;

    /**
     * The VS Code command ID that this command maps to.
     * @example "azureFunctions.createNewFunctionProject"
     */
    commandId: string;

    /**
     * The display name of the command.
     * @example "Create New Function Project"
     */
    displayName: string;

    /**
     * A sentence description that helps a LLM understand when the command should be used.
     *
     * The description should give an understanding of what a user prompt which matches to this
     * command would look like. Give examples of terminology that the user might use, the type of
     * statements they might make, and the type of questions they might ask. Also consider giving
     * examples of what terminology or types of statements would not match to this command.
     *
     * For example:
     *
     * *This is best when users ask to create a Function App resource in Azure. They may refer
     * to a Function App as 'Function App', 'function', 'function resource', 'function app
     * resource', 'function app' etc. This command is not useful if the user is asking how to do something, or
     * if something is possible.*
     */
    intentDescription?: string;

    /**
     * If the command requires that a workspace is currently open.
     */
    requiresWorkspaceOpen?: boolean;

    /**
     * If the command requires that the user is logged into Azure.
     */
    requiresAzureLogin?: boolean;
}

/**
 * A config that describes a command that the extension implements which makes use of wizards that use
 * an {@link IAzureAgentInput}/{@link IAzureUserInput} to get user input.
 */
export type WizardCommandConfig = BaseCommandConfig & { type: "wizard"; };

/**
 * A config that describes a command that the extension implements which doesn't involve any additonal agent interaction
 * other than suggesting the command.
 */
export type SimpleCommandConfig = BaseCommandConfig & { type: "simple"; };

/**
 * Information that should be available on the package.json of an extension which is compabitible with the Azure agent.
 * This information should be placed in an `agentMetdata` property.
 */
export type ExtensionAgentMetadata = {
    version: "1.0";

    /**
     * The VS Code command ID of a command that the extension implements which can be used to get the list
     * of command configs that the extension implements and wishes to expose via the agent.
     */
    getCommandsCommandId: string;

    /**
     * The VS Code command ID of a command that the extension implements which can be used to run any of the {@link WizardCommandConfig}
     * commands the extension exposes, while only performing prompting/without actually executing the intent of the command.
     *
     * The command should take two parameters:
     * - A {@link WizardCommandConfig}: the command that should be run.
     * - A {@link IAzureAgentInput}: the input interface that the command should use.
     */
    runWizardCommandWithoutExecutionCommandId: string;

    /**
     * The VS Code command ID of a command that the extension implements which can be used to run any of the {@link WizardCommandConfig}
     * commands the extension exposes, with a {@link AzureUserInputQueue} of inputs,
     *
     * The command should take two parameters:
     * - A {@link WizardCommandConfig}: the command that should be run.
     * - A {@link AzureUserInputQueue}: the inputs that the command should use when needing to present user input.
     */
    runWizardCommandWithInputsCommandId: string;

    /**
     * The VS Code command ID of a command that the extension implements which can be used to get the list of
     * {@link AgentBenchmarkConfig}s that the extension defines. These benchmarks should serve as a way to benchmark
     * the performance of the agent with regards to functionality that the subcommands associated with the extension
     * expose.
     */
    getAgentBenchmarkConfigsCommandId: string;
};

/**
 * A config that describes a benchmark to be run against the agent.
 */
export type AgentBenchmarkConfig = {
    /**
     * The name of the benchmark. Does not need to be unique, but is useful if it can be.
     */
    name: string;

    /**
     * The simulated user input to be given to the agent when running the benchmark.
     */
    prompt: string;

    /**
     * Acceptable handler chains for the `prompt`. Each entry in a handler chain is a string that represents a handler, in the
     * order that the handlers are called. For {@link WizardCommandConfig} related subcommands, the {@link WizardCommandConfig.name}
     * is the handler name.
     */
    acceptableHandlerChains: string[][];

    /**
     * Follow ups that are required/optional to be returned by the agent given the {@link AgentBenchmarkConfig.prompt}.
     */
    followUps?: {
        required: { type: "message", messageContains: string }[],
        optional: { type: "message", messageContains: string }[],
    };

    /**
     * Buttons that are required/optional to be returned by the agent given the {@link AgentBenchmarkConfig.prompt}.
     */
    buttons?: {
        required: { type: "command", commandId: string }[],
        optional: { type: "command", commandId: string }[],
    }
};

/**
 * An LM tool that additionally passes IActionContext and records telemetry for both invoke and prepareInvocation
 */
export interface AzExtLMTool<T> {
    /**
     * Prepare for invocation, which can be used to provide confirmation prompts etc. If the tool invocation has side effects, this should be implemented.
     * `prepareInvocation` should *not* have side effects.
     * @param context The action context
     * @param options The LM tool prepare invocation options
     * @param token A cancellation token
     */
    prepareInvocation?(context: IActionContext, options: LanguageModelToolInvocationPrepareOptions<T>, token: CancellationToken): ProviderResult<PreparedToolInvocation>;

    /**
     * Invokes the LM tool. If this throws an error, it will be recorded in telemetry appropriately, but the error will be caught and converted into a message to give to the LM.
     * @param context The action context
     * @param options The LM tool invocation options
     * @param token A cancellation token
     */
    invoke(context: IActionContext, options: LanguageModelToolInvocationOptions<T>, token: CancellationToken): ProviderResult<LanguageModelToolResult>;
}
