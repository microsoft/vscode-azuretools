/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as os from 'os';
import { CommandOptions } from '../CommandOptions';
import { localize } from '../localize';

export namespace cpUtils {
    export async function executeCommand(commandOptions: CommandOptions): Promise<string> {
        const command: string = commandOptions.command;
        const result: ICommandResult = await tryExecuteCommand(commandOptions);
        // command is only being used to output at this point so we can alter it
        if (result.code !== 0) {
            // We want to make sure the full error message is displayed to the user, not just the error code.
            // If outputChannel is defined, then we simply call 'outputChannel.show()' and throw a generic error telling the user to check the output window
            // If outputChannel is _not_ defined, then we include the command's output in the error itself and rely on AzureActionHandler to display it properly

            if (commandOptions.showOutputChannel()) {
                throw new Error(localize('commandErrorWithOutput', 'Failed to run "{0}" command. Check output window for more details.', command));
            } else {
                throw new Error(localize('commandError', 'Command "{0} {1}" failed with exit code "{2}":{3}{4}', commandOptions.obfuscateValue(command),
                    commandOptions.obfuscateValue(result.formattedArgs), result.code, os.EOL, commandOptions.obfuscateValue(result.cmdOutputIncludingStderr)));
            }
        } else {
            commandOptions.tryAppendLine(localize('finishedRunningCommand', 'Finished running command: "{0} {1}".', command, result.formattedArgs));
        }
        return result.cmdOutput;
    }

    export async function tryExecuteCommand(commandOptions: CommandOptions): Promise<ICommandResult> {
        return await new Promise((resolve: (res: ICommandResult) => void, reject: (e: Error) => void): void => {
            let cmdOutput: string = '';
            let cmdOutputIncludingStderr: string = '';
            const formattedArgs: string = commandOptions.args.join(' ');
            const command: string = commandOptions.command;

            const workingDirectory: string = commandOptions.workingDirectory ? commandOptions.workingDirectory : os.tmpdir();
            const options: cp.SpawnOptions = {
                cwd: workingDirectory,
                shell: true
            };

            const childProc: cp.ChildProcess = cp.spawn(command, commandOptions.args, options);
            const runningCommand: string = localize('runningCommand', 'Running command: "{0} {1}"...', command, formattedArgs);
            if (commandOptions) {
                commandOptions.tryAppend(runningCommand);
            }

            childProc.stdout.on('data', (data: string | Buffer) => {
                data = data.toString();
                cmdOutput = cmdOutput.concat(data);
                cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
                commandOptions.tryAppend(data);
            });

            childProc.stderr.on('data', (data: string | Buffer) => {
                data = data.toString();
                cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
                commandOptions.tryAppend(data);
            });

            childProc.on('error', reject);
            childProc.on('close', (code: number) => {
                resolve({
                    code,
                    cmdOutput,
                    cmdOutputIncludingStderr,
                    formattedArgs
                });
            });
        });
    }

    export interface ICommandResult {
        code: number;
        cmdOutput: string;
        cmdOutputIncludingStderr: string;
        formattedArgs: string;
    }
}
