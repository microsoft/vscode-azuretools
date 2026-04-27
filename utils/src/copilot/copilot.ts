/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { CopilotClient, CopilotSession } from "@github/copilot-sdk";
import type * as vscode from "vscode";
import { InvalidCopilotResponseError } from "../errors";

let client: CopilotClient | undefined;
let session: CopilotSession | undefined;

async function loadCopilotSdk(): Promise<typeof import("@github/copilot-sdk")> {
    return await import("@github/copilot-sdk");
}

function getCopilotCliPath(): string {
    return require.resolve(`@github/copilot-${process.platform}-${process.arch}`);
}

export function createPrimaryPromptToGetSingleQuickPickInput(picks: string[], placeholder?: string): string {
    return `
        Task: choose one pick.

        Input:
        picks: ${JSON.stringify(picks)}
        placeholder: ${placeholder ?? null}

        Rules:
        - If the picks represent container image tags, always prefer the newest available image tag.

        Output:
        Return ONLY the JSON object with fields "label" and "description".
        `;
}

export function createPrimaryPromptToGetPickManyQuickPickInput(picks: string[], relevantContext?: string): string {
    return `The User is asking you to choose multiple items based on the following information:
        1. Choose from this list of picks ${picks.join(", ")}.
        2. You must choose at least one item from the list, but you can choose more than one.
        3. Use information from this context, if available, to make your decision: ${relevantContext ? relevantContext : "No context available"}
        Respond with a JSON array of the picks you have chosen. Do not respond in a conversational tone, only JSON. `;
}

export function createPrimaryPromptForInputBox(inputQuestion: string, relevantContext?: string): string {
    return `The User is asking you to provide an input based on the following information:
        1. The questions is: ${inputQuestion}
        2. Use information from this context, if available, to make your decision: ${relevantContext ? relevantContext : "No context available"}
        Respond with a string containing the input value. Do not respond in a conversational tone.`;
}

export function createPrimaryPromptForWarningMessage(message: string, items: vscode.MessageItem[]): string {
    return `The user is asking you to provide a response to a warning message based on the following information:
        1. The warning message is: ${message}
        2. The options to pick from are ${items.map(i => i.title).join(", ")}}
        Respond with a string of the item you have chosen. Do not respond in a conversational tone. `;
}

export function createPrimaryPromptForWorkspaceFolderPick(folders: readonly vscode.WorkspaceFolder[] | undefined, relevantContext?: string): string {
    return `The User is asking you to choose a workspace folder based on the following information:
        1. Choose from this list of workspace folders ${folders ? folders.map(f => f.name).join(", ") : ''} If there are no folders in the list return ''.
        2. You must choose one workspace folder from the list
        3. Use information from this context, if available, to make your decision: ${relevantContext ? relevantContext : "No context available"}
        Respond with the workspace folder you have chosen. Do not respond in a conversational tone. `;
}

export async function doGithubCopilotInteraction(primaryPrompt: string, relevantContext?: string): Promise<string> {
    const session = await getCopilotSession(relevantContext);
    const response = await session.sendAndWait({
        prompt: primaryPrompt,
        mode: "immediate"
    });

    if (!response || !response.data) {
        throw new InvalidCopilotResponseError();
    }

    return response?.data.content;
}

export async function getCopilotSession(relevantContext?: string): Promise<CopilotSession> {
    if (session) {
        return session;
    }

    const { CopilotClient } = await loadCopilotSdk();
    client = new CopilotClient({ cliPath: getCopilotCliPath() });
    session = await client.createSession({
        onPermissionRequest: () => ({ kind: "approved" })
    });
    const activityChildren = extractActivityChildren(relevantContext || '');
    const subscriptionId = relevantContext ? extractSubscriptionIdFromContext(relevantContext) : undefined;

    await session.sendAndWait({
        mode: "immediate",
        prompt: `Picker. Choose one. Never explain your reasoning. Never use markdown. Output: {"label":"X","description":"Y"}

            Rules (priority)
            1. Match activityChildren "Use X" → pick X
            2. Match subscriptionId → pick.data /subscriptions/{id}
            3. Else skipForNow

            Context: ${JSON.stringify({ activityChildren, subscriptionId, relevantContext })}`
    });

    return session;
}

export async function disposeCopilotSession(): Promise<void> {
    if (client) {
        await client.stop();
        client = undefined;
        session = undefined;
    }
}

function extractSubscriptionIdFromContext(context: string): string | undefined {
    const regex = /https:\/\/management\.[^/]+\/subscriptions\/([0-9a-fA-F-]{36})/;
    const match = context.match(regex);
    return match ? match[1] : undefined;
}

function extractActivityChildren(context: string): string | undefined {
    try {
        const activityLog = JSON.parse(context) as { children?: unknown };
        const children = activityLog.children;
        return JSON.stringify(children);
    } catch {
        return undefined;
    }
}
