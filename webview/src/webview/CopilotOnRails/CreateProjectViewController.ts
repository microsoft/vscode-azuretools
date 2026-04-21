/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ViewColumn } from "vscode";
import { WebviewController } from "../extension-server/WebviewController";
import { ext } from "../extensionVariables";

export type CreateProjectViewControllerType = {
    title: string;
}

export class CreateProjectViewController extends WebviewController<CreateProjectViewControllerType> {
    constructor(viewConfig: CreateProjectViewControllerType) {
        super(ext.context, viewConfig.title, 'createProjectView', viewConfig, ViewColumn.Active);

        this.panel.webview.onDidReceiveMessage(
            (message: { command: string; prompt?: string }) => {
                switch (message.command) {
                    case 'plan':
                        this.panel.dispose();
                        if (message.prompt) {
                            void this.openChatWithQuery(`/azure-project-plan ${message.prompt}`);
                        }
                        break;
                    case 'build':
                        this.panel.dispose();
                        if (message.prompt) {
                            void this.openChatWithQuery(`/azure-project-plan ${message.prompt}`); // TODO: Change to build command when implemented
                        }
                        break;
                }
            }
        );
    }

    private async openChatWithQuery(query: string): Promise<void> {
        await vscode.commands.executeCommand("workbench.action.chat.open");
        await vscode.commands.executeCommand("azureProjectCreation.show");
        await vscode.commands.executeCommand("azureProjectCreation.focus", ['projectCreation/plan']);
        await vscode.commands.executeCommand("workbench.action.chat.newChat");
        await vscode.commands.executeCommand("workbench.action.chat.open", {
            mode: 'agent',
            query,
        });
    }
}
