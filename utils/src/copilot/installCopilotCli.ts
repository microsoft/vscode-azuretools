/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { type CommandLineArgs, composeArgs, spawnStreamAsync, withArg } from "@microsoft/vscode-processutils";
import { Writable } from "stream";
import * as vscode from "vscode";
import { ext } from "../extensionVariables";

interface InstallCommand {
    command: string;
    args: CommandLineArgs;
}

export async function isCopilotCliInstalled(): Promise<boolean> {
    try {
        await spawnStreamAsync('copilot', composeArgs(withArg('--version'))(), {});
        return true;
    } catch {
        return false;
    }
}

export async function ensureCopilotCliInstalled(): Promise<boolean> {
    const copilotCliInstalled = await isCopilotCliInstalled();
    if (!copilotCliInstalled) {
        const install: vscode.MessageItem = { title: vscode.l10n.t('Install') };
        const cancel: vscode.MessageItem = { title: vscode.l10n.t('Cancel') };
        const response = await vscode.window.showWarningMessage(
            vscode.l10n.t('GitHub Copilot CLI is required to run this command. Would you like to install it?'),
            install,
            cancel,
        );

        if (response === install) {
            try {
                await installCopilotCli();
                void vscode.window.showInformationMessage(vscode.l10n.t('GitHub Copilot CLI installed successfully. Please rerun the command.'));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                ext.outputChannel.appendLog(vscode.l10n.t('Failed to install GitHub Copilot CLI: {0}', errorMessage));
                const docLink: vscode.MessageItem = { title: vscode.l10n.t('Installation Guide') };
                const result = await vscode.window.showErrorMessage(
                    vscode.l10n.t('Failed to install GitHub Copilot CLI automatically. Please install it manually and rerun the command.'),
                    docLink,
                );
                if (result === docLink) {
                    await vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/githubCopilotCLIInstallation'));
                }
            }
        }
        return false;
    }
    return true;
}

export async function installCopilotCli(): Promise<void> {
    const installCommand = await getInstallCopilotCliCommand();
    const npmFallbackCommand: InstallCommand = { command: 'npm', args: composeArgs(withArg('install', '-g', '@github/copilot'))() };
    ext.outputChannel.show();

    try {
        await runInstallCommand(installCommand);
    } catch (error) {
        if (installCommand.command === 'npm') {
            throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        ext.outputChannel.appendLog(vscode.l10n.t('Installation via "{0}" failed: {1}', installCommand.command, errorMessage));
        ext.outputChannel.appendLog(vscode.l10n.t('Falling back to npm...'));
        await runInstallCommand(npmFallbackCommand);
    }
}

async function runInstallCommand(installCommand: InstallCommand): Promise<void> {
    ext.outputChannel.appendLog(vscode.l10n.t('Installing GitHub Copilot CLI via "{0}"...', installCommand.command));

    const outputStream = new Writable({
        write(chunk, _encoding, callback) {
            ext.outputChannel.appendLog(chunk.toString());
            callback();
        },
    });

    await spawnStreamAsync(installCommand.command, installCommand.args, {
        shell: true,
        stdOutPipe: outputStream,
        stdErrPipe: outputStream,
    });
}

async function getInstallCopilotCliCommand(): Promise<InstallCommand> {
    switch (process.platform) {
        case 'win32':
            return { command: 'winget', args: composeArgs(withArg('install', 'GitHub.Copilot'))() };
        case 'darwin': {
            try {
                await spawnStreamAsync('brew', composeArgs(withArg('--version'))(), {});
                return { command: 'brew', args: composeArgs(withArg('install', 'copilot-cli'))() };
            } catch {
                ext.outputChannel.appendLog(
                    vscode.l10n.t('Homebrew is not installed. For more installation options, visit: {0}', 'https://aka.ms/githubCopilotCLIInstallation'),
                );
                return { command: 'npm', args: composeArgs(withArg('install', '-g', '@github/copilot'))() };
            }
        }
        default:
            return { command: 'npm', args: composeArgs(withArg('install', '-g', '@github/copilot'))() };
    }
}
