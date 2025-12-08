/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as types from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { isUserCancelledError } from './errors';
import { ext } from './extensionVariables';
import { parseError } from './parseError';

export function registerLMTool<T>(name: string, tool: types.AzExtLMTool<T>): void {
    const vscodeTool: vscode.LanguageModelTool<T> = {
        invoke: async (options, token) => {
            let result: vscode.LanguageModelToolResult | undefined | null;

            await callWithTelemetryAndErrorHandling(`${name}.invoke`, async (context: types.IActionContext) => {
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

            if (!result) {
                result = {
                    content: [new vscode.LanguageModelTextPart('No result was returned.')],
                };
            }

            return result;
        }
    };

    if (tool.prepareInvocation) {
        vscodeTool.prepareInvocation = async (options, token) => {
            return await callWithTelemetryAndErrorHandling(`${name}.prepareInvocation`, async (context: types.IActionContext) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return await tool.prepareInvocation!(context, options, token);
            });
        };
    }

    ext.context.subscriptions.push(
        vscode.lm.registerTool(name, vscodeTool)
    );
}
