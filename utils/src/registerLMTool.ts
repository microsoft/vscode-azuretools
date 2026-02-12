/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { IActionContext } from './types/actionContext';
import type { AzExtLMTool } from './types/agentInput';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { isUserCancelledError } from './errors';
import { ext } from './extensionVariables';
import { parseError } from './parseError';

/**
 * Registers a language model tool, wrapping it with telemetry and error handling
 * @param name The name of the tool. Must match what is in package.json.
 * @param tool The tool itself
 */
export function registerLMTool<T>(name: string, tool: AzExtLMTool<T>): void {
    const vscodeTool: vscode.LanguageModelTool<T> = {
        invoke: async (options, token) => {
            let result: vscode.LanguageModelToolResult | undefined | null;

            await callWithTelemetryAndErrorHandling(`${name}.invoke`, async (context: IActionContext) => {
                context.telemetry.properties.isCopilotEvent = 'true';

                try {
                    result = await tool.invoke(context, options, token);
                } catch (err) {
                    if (isUserCancelledError(err)) {
                        result = {
                            content: [new vscode.LanguageModelTextPart('The operation was cancelled.')],
                        };
                    } else {
                        const error = parseError(err);
                        result = {
                            content: [new vscode.LanguageModelTextPart(`An error occurred: ${error.message}`)],
                        };
                    }

                    throw err; // Rethrow the error so telemetry and error handling can process it
                }
            });

            result ??= {
                content: [new vscode.LanguageModelTextPart('No result was returned.')],
            };

            return result;
        }
    };

    if (tool.prepareInvocation) {
        vscodeTool.prepareInvocation = async (options, token) => {
            return await callWithTelemetryAndErrorHandling(`${name}.prepareInvocation`, async (context: IActionContext) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return await tool.prepareInvocation!(context, options, token);
            });
        };
    }

    ext.context.subscriptions.push(
        vscode.lm.registerTool(name, vscodeTool)
    );
}
