/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import { InvalidCopilotResponseError } from "../errors";

const languageModelPreference: { vendor: "copilot", family: string }[] = [
    { vendor: "copilot", family: "gpt-5-mini" },
    { vendor: "copilot", family: "claude-sonnet-4" },
    { vendor: "copilot", family: "claude-sonnet-4.5" },
    { vendor: "copilot", family: "gpt-4o" },
    { vendor: "copilot", family: "gpt-4-turbo" },
    { vendor: "copilot", family: "gpt-4" },
    { vendor: "copilot", family: "gpt-3.5-turbo" },
];

async function selectMostPreferredLm(): Promise<vscode.LanguageModelChat | undefined> {
    const lms = await vscode.lm.selectChatModels({ vendor: "copilot" });
    const lmsInPreferredOrder = (lms || [])
        .filter((lm) => languageModelPreference.some((pref) => pref.family === lm.family && pref.vendor === lm.vendor))
        .sort((a, b) => languageModelPreference.findIndex((pref) => pref.family === a.family && pref.vendor === a.vendor) - languageModelPreference.findIndex((pref) => pref.family === b.family && pref.vendor === b.vendor));
    return lmsInPreferredOrder?.at(0);
}

export function createPrimaryPromptToGetSingleQuickPickInput(picks: string[], placeholder?: string, relevantContext?: string): string {
    const subscriptionId = relevantContext ? extractSubscriptionIdFromContext(relevantContext) : undefined;
    const activityChildren = extractActivityChildren(relevantContext || '');
    return `The User is asking you to choose an item based on the following information:
        1. Choose from this list of picks ${picks.join(", ")}.
        2. You must choose one item from the list
        3. The placeholder contains the question being asked use this to help guide your input: ${placeholder ? placeholder : "No placeholder available"}
        4. Use information from this context, if available, to make your decision: ${relevantContext ? relevantContext : "No context available"}
        5. If there are activity children you must use them to them to inform your decision: ${activityChildren ? activityChildren : "No activity children available"}
        Here are some examples on how to use activity children to inform your decision:
            - If the placeholder is 'Select a container app' and there is an activity child 'Use container app: myContainerApp', you should choose the pick with the label 'myContainerApp' from the picks.
            - If the placeholder is 'Select a container apps environment' and there is an activity child 'Use managed environment: myEnv', you should choose the pick with the label'myEnv' from the picks.
        6. If there is an option to skipForNow, you can choose that option.
        7. If the placeholder is 'Select subscription' use the subscription id to help guide your input. Use the subscription id: ${subscriptionId}
        and match to the data portion of the picks which will have the id in the form of accounts/{accountId}/tenants/{tenantId}/subscriptions/{subscriptionID}. Match the {subscriptionId} portions to inform your decision.
        Respond with a JSON object of the pick you have chosen. Do not respond in a conversational tone, only JSON. `;
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

export async function doCopilotInteraction(primaryPrompt: string): Promise<string> {
    let messages: vscode.LanguageModelChatMessage[] = [];
    const lm: vscode.LanguageModelChat | undefined = await selectMostPreferredLm();

    messages = [
        new vscode.LanguageModelChatMessage(vscode.LanguageModelChatMessageRole.User, primaryPrompt)
    ];

    if (lm !== undefined) {
        const chatRequestOptions = { justification: `Access to Copilot for the @azure agent.` };
        const request = await lm.sendRequest(messages, chatRequestOptions);
        const fragments: string[] = [];
        try {
            // Consume the stream and collect fragments
            for await (const fragment of request.text) {
                fragments.push(fragment);
            }

            // Combine fragments into a single string
            const responseText = fragments.join("");
            const cleanedResponse = extractJsonString(responseText);
            return cleanedResponse;
        } catch {
            throw new InvalidCopilotResponseError();
        }
    }
    return "";
}

function extractJsonString(raw: string): string {
    return raw.replace(/```json\s*|```/g, '').trim();
}

function extractSubscriptionIdFromContext(context: string): string | undefined {
    const regex = /https:\/\/management\.azure\.com\/subscriptions\/([0-9a-fA-F-]{36})/;
    const match = context.match(regex);
    return match ? match[1] : undefined;
}

function extractActivityChildren(context: string): string {
    const activityLog = JSON.parse(context) as { children?: unknown };
    const children = activityLog.children;
    return JSON.stringify(children);
}
