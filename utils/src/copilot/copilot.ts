/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import * as vscode from "vscode";
import { InvalidCopilotResponseError } from "../errors";

const languageModelPreference: { vendor: "copilot", family: string }[] = [
    // not yet seen/available
    // { vendor: "copilot", family: "gpt-4-turbo-preview" },
    // seen/available
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

export function createPrimaryPromptToGetSingleQuickPickInput(picks: string[], relevantContext?: string): string {
    return `The User is asking you to choose an item based on the following information:
        1. Choose from this list of picks ${picks.join(", ")}.
        2. You must choose one item from the list
        3. Use information from this context, if available, to make your decision: ${relevantContext ? relevantContext : "No context available"}
        4. If there is an option to skipForNow, you can choose that option.
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
        const chatRequestOptions = { justification: `Access to Copilot for the @azure agent.` }
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
