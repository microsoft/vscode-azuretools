/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from "assert";
import { Event, MessageItem, QuickPickItem, Uri } from "vscode";
import { AgentInputBoxOptions, AgentQuickPickItem, AgentQuickPickOptions, AzExtInputBoxOptions, AzExtOpenDialogOptions, IAzureAgentInput, IAzureMessageOptions, IAzureQuickPickOptions, IAzureUserInput, PromptResult } from "..";

class MockAzureUserInput implements IAzureUserInput {
    onDidFinishPrompt: Event<PromptResult>;
    showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: IAzureQuickPickOptions & { canPickMany: true; }): Promise<T[]>;
    showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options: IAzureQuickPickOptions): Promise<T>;
    showQuickPick<T>(_items: unknown, _options: unknown): Promise<T[]> | Promise<T> {
        throw new Error("Method not implemented.");
    }
    showInputBox(_options: AzExtInputBoxOptions): Promise<string> {
        throw new Error("Method not implemented.");
    }
    showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    showWarningMessage<T extends MessageItem>(message: string, options: IAzureMessageOptions, ...items: T[]): Promise<T>;
    showWarningMessage<T>(): Promise<T> | Promise<T> {
        throw new Error("Method not implemented.");
    }
    showOpenDialog(_options: AzExtOpenDialogOptions): Promise<Uri[]> {
        throw new Error("Method not implemented.");
    }
}

class MockAzureAgentInput implements IAzureAgentInput {
    onDidFinishPrompt: Event<PromptResult>;
    showQuickPick<ItemsBaseT extends QuickPickItem, OptionsBaseT extends IAzureQuickPickOptions>(items: Thenable<AgentQuickPickItem<ItemsBaseT>[]> | AgentQuickPickItem<QuickPickItem>[], options: { agentMetadata: { paramterNameTitle: string; parameterName: string; parameterDescription: string; }; } & OptionsBaseT & { canPickMany: true; }): Promise<AgentQuickPickItem<ItemsBaseT>[]>;
    showQuickPick<ItemsBaseT extends QuickPickItem, OptionsBaseT extends IAzureQuickPickOptions>(items: AgentQuickPickItem<ItemsBaseT>[] | Thenable<AgentQuickPickItem<ItemsBaseT>[]>, options: AgentQuickPickOptions<OptionsBaseT>): Promise<AgentQuickPickItem<ItemsBaseT>>;
    showQuickPick<ItemsBaseT extends QuickPickItem>(_items: unknown, _options: unknown): Promise<AgentQuickPickItem<ItemsBaseT>[]> | Promise<AgentQuickPickItem<ItemsBaseT>> {
        throw new Error("Method not implemented.");
    }
    showInputBox<OptionsBaseT extends IAzureQuickPickOptions>(_options: AgentInputBoxOptions<OptionsBaseT>): Promise<string> {
        throw new Error("Method not implemented.");
    }
    showWarningMessage<T extends MessageItem>(message: string, ...items: T[]): Promise<T>;
    showWarningMessage<T extends MessageItem>(message: string, options: IAzureMessageOptions, ...items: T[]): Promise<T>;
    showWarningMessage<T>(): Promise<T> | Promise<T> {
        throw new Error("Method not implemented.");
    }
    showOpenDialog(_options: AzExtOpenDialogOptions): Promise<Uri[]> {
        throw new Error("Method not implemented.");
    }
}

const mockAzureUserInput: IAzureUserInput = new MockAzureUserInput();
const mockAzureAgentInput: IAzureAgentInput = new MockAzureAgentInput();

suite("Azure Agent Input Type Check", () => {
    test("Azure Agent Input Can Be Used as Azure User Input", async () => {
        const azureUserInputSetFromAgentInput: IAzureUserInput = mockAzureAgentInput;
        assert.equal(azureUserInputSetFromAgentInput, mockAzureAgentInput);
    });
    test("Azure User Input Can Be Used as Azure Agent Input", async () => {
        const azureAgentInputSetFromUserInput: IAzureAgentInput = mockAzureUserInput;
        assert.equal(azureAgentInputSetFromUserInput, mockAzureUserInput);
    });
});
