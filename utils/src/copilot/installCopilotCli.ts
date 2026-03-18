/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { composeArgs, spawnStreamAsync, withArg } from "@microsoft/vscode-processutils";
import * as cp from "child_process";
import * as path from "path";
import { Writable } from "stream";
import * as vscode from "vscode";
import { ext } from "../extensionVariables";

export async function isCopilotCliInstalled(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        cp.exec('copilot --version', (error) => {
            resolve(!error);
        });
    });
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
                    vscode.l10n.t('Failed to install GitHub Copilot CLI automatically. Please install it manually.'),
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
    const installCommand = getInstallCopilotCliCommand();
    ext.outputChannel.show();
    ext.outputChannel.appendLog(vscode.l10n.t('Installing GitHub Copilot CLI via "{0}"...', installCommand.join(' ')));

    const outputStream = new Writable({
        write(chunk, _encoding, callback) {
            ext.outputChannel.appendLog(chunk.toString());
            callback();
        },
    });

    await spawnStreamAsync(installCommand[0], composeArgs(withArg(...installCommand.slice(1)))(), {
        shell: true,
        stdOutPipe: outputStream,
        stdErrPipe: outputStream,
    });
}

function getInstallCopilotCliCommand(): string[] {
    switch (process.platform) {
        case 'win32': {
            const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
            const wingetPath = path.join(localAppData, 'Microsoft', 'WindowsApps', 'winget.exe');
            return [wingetPath, 'install', 'GitHub.Copilot'];
        }
        case 'darwin': {
            const brewPath = process.arch === 'arm64' ? '/opt/homebrew/bin/brew' : '/usr/local/bin/brew';
            return [brewPath, 'install', 'copilot-cli'];
        }
        default:
            return ['npm', 'install', '-g', '@github/copilot'];
    }
}
