/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as types from '../index';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ext } from './extensionVariables';

export function registerLMTool<T>(name: string, tool: types.AzExtLMTool<T>): void {
    const vscodeTool: vscode.LanguageModelTool<T> = {
        invoke: async (options, token) => {
            return await callWithTelemetryAndErrorHandling(`${name}.invoke`, async (context: types.IActionContext) => {
                return await tool.invoke(context, options, token);
            });
        }
    };

    if (tool.prepareInvocation) {
        vscodeTool.prepareInvocation = async (options, token) => {
            return await callWithTelemetryAndErrorHandling(`${name}.prepareInvocation`, async (context: types.IActionContext) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return await tool.prepareInvocation!(context, options, token);
            });
        }
    }

    ext.context.subscriptions.push(
        vscode.lm.registerTool(name, vscodeTool)
    );
}
