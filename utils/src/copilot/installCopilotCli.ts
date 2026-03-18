/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as cp from "child_process";
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
            } catch {
                const docLink: vscode.MessageItem = { title: vscode.l10n.t('Installation Guide') };
                const result = await vscode.window.showErrorMessage(
                    vscode.l10n.t('Failed to install GitHub Copilot CLI automatically. Please install it manually.'),
                    docLink,
                );
                if (result === docLink) {
                    await vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/githubCopiloCLIInstallation'));
                }
            }
        }
        return false;
    }
    return true;
}

export async function installCopilotCli(): Promise<void> {
    const command = getInstallCopilotCliCommand();
    ext.outputChannel.show();
    ext.outputChannel.appendLog(vscode.l10n.t('Installing GitHub Copilot CLI via "{0}"...', command));

    return new Promise<void>((resolve, reject) => {
        cp.exec(command, (error, stdout, stderr) => {
            if (stdout) {
                ext.outputChannel.appendLog(stdout);
            }
            if (error) {
                if (stderr) {
                    ext.outputChannel.appendLog(stderr);
                }
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

function getInstallCopilotCliCommand(): string {
    switch (process.platform) {
        case 'win32':
            return 'winget install GitHub.Copilot';
        case 'darwin':
            return 'brew install copilot-cli';
        default:
            return 'npm install -g @github/copilot';
    }
}
