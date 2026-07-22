/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { type CommandLineArgs, composeArgs, getSafeExecPath, spawnStreamAsync, withArg } from "@microsoft/vscode-processutils";
import { existsSync } from "fs";
import * as path from "path";
import { Writable } from "stream";
import * as vscode from "vscode";
import { ext } from "../extensionVariables";

interface InstallCommand {
    command: string;
    args: CommandLineArgs;
}

/**
 * Resolves the full filesystem path to the platform-specific `@github/copilot` binary,
 * falling back to a globally installed `copilot` CLI on PATH.
 *
 * We must resolve a real, absolute file path because `CopilotClient` validates `cliPath`
 * with `existsSync()` and does not search PATH for bare command names.
 *
 * @internal Exported for testing.
 */
export function getCopilotCliPath(): string {
    try {
        return require.resolve(`@github/copilot-${process.platform}-${process.arch}`);
    } catch {
        // The platform-specific binary package is not present. Fall back to a globally installed `copilot` CLI on PATH.
        return resolveCopilotCliFromPath() ?? 'copilot';
    }
}

/**
 * Searches PATH for the `copilot` executable and returns its absolute path, or `undefined`
 * if it cannot be found. Uses {@link getSafeExecPath} to resolve against PATH and verifies the
 * result with `existsSync()`, then falls back to a manual PATH scan (which also resolves a real
 * file path on non-Windows platforms, where `getSafeExecPath` returns the bare command name).
 */
function resolveCopilotCliFromPath(): string | undefined {
    try {
        const execPath = getSafeExecPath('copilot');
        if (path.isAbsolute(execPath) && existsSync(execPath)) {
            return execPath;
        }
    } catch {
        // `copilot` was not found on PATH; fall through to a manual scan.
    }

    return scanPathForCopilot();
}

function scanPathForCopilot(): string | undefined {
    const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(dir => dir.length > 0);
    const exeNames = process.platform === 'win32'
        ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').map(pathExt => `copilot${pathExt.trim().toLowerCase()}`)
        : ['copilot'];

    for (const dir of pathDirs) {
        for (const exeName of exeNames) {
            const candidate = path.join(dir, exeName);
            if (existsSync(candidate)) {
                return candidate;
            }
        }
    }

    return undefined;
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
            ext.outputChannel.appendLog(String(chunk));
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
