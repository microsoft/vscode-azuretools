/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzureLogger } from '@azure/logger'; // Keep this as `import type` to avoid actually loading the package
import { inspect } from 'util';
import type * as vscode from 'vscode';

function format(args: unknown[]): string {
    return args.map(arg => typeof arg === 'string' ? arg : inspect(arg)).join(' ');
}

/**
 * Adapts a VS Code {@link vscode.LogOutputChannel} to an `@azure/logger` {@link AzureLogger}, so the new
 * (`./next`) auth core—which logs to an `AzureLogger`—can route its diagnostics to a VS Code output channel
 * for the legacy entrypoint.
 *
 * @remarks Only the `info`, `warning`, `error`, and `verbose` members are implemented (the only ones the
 * core uses). The result is cast to {@link AzureLogger} because a real `AzureLogger` member is a `debug`
 * `Debugger` with additional properties we don't need here.
 *
 * @param channel The VS Code output channel to route log messages to.
 * @returns An {@link AzureLogger} that writes to the given channel.
 */
export function createAzureLoggerForOutputChannel(channel: vscode.LogOutputChannel): AzureLogger {
    return {
        info: (...args: unknown[]) => { channel.info(format(args)); },
        warning: (...args: unknown[]) => { channel.warn(format(args)); },
        error: (...args: unknown[]) => { channel.error(format(args)); },
        verbose: (...args: unknown[]) => { channel.debug(format(args)); },
    } as unknown as AzureLogger;
}
