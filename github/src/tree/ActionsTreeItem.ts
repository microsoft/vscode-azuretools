/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IActionContext, TreeElementBase, callWithTelemetryAndErrorHandling, createGenericElement, nonNullValue } from "@microsoft/vscode-azext-utils";
import { ThemeIcon, TreeItem, TreeItemCollapsibleState, l10n } from "vscode";
import { gitHubUrlParse } from "../utils/gitHubUrlParse";
import { ActionsListWorkflowRuns, GetActionsListWorkflowRunsParams, getActions } from "../wrappers/getActions";
import { ActionTreeItem } from "./ActionTreeItem";

export interface ConnectToGitHubCommand {
    commandId: string;
    commandArgs: unknown[] | undefined;
}

export abstract class ActionsTreeItem implements TreeElementBase {
    static idSuffix: string = 'actions';
    static contextValueConnectedSuffix: string = 'ActionsConnected';
    static contextValueUnconnectedSuffix: string = 'ActionsUnconnected';

    constructor(readonly parentId: string, readonly contextValueExtensionPrefix: string) { }

    id: string = `${this.parentId}/${ActionsTreeItem.idSuffix}`;
    label: string = 'Actions';

    contextValueConnected: string = `${this.contextValueExtensionPrefix}${ActionsTreeItem.contextValueConnectedSuffix}`;
    contextValueUnconnected: string = `${this.contextValueExtensionPrefix}${ActionsTreeItem.contextValueUnconnectedSuffix}`;

    async getTreeItem(): Promise<TreeItem> {
        const hasSourceControl: boolean = !!await this.getSourceControlUrl();
        return {
            id: this.id,
            label: this.label,
            description: hasSourceControl ? l10n.t('Connected') : '',
            iconPath: new ThemeIcon('github-inverted'),
            contextValue: hasSourceControl ? this.contextValueConnected : this.contextValueUnconnected,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
        };
    }

    async getChildren(): Promise<TreeElementBase[]> {
        const sourceControlUrl: string | undefined = await this.getSourceControlUrl();

        let sourceControlBranch: string | undefined;
        if (this.getSourceControlBranch) {
            sourceControlBranch = await this.getSourceControlBranch();
        }

        const actionsListWorkflowRuns: ActionsListWorkflowRuns | undefined = await callWithTelemetryAndErrorHandling('getActionsChildren', async (context: IActionContext) => {
            if (!sourceControlUrl) {
                return undefined;
            }

            const { ownerOrOrganization, repositoryName } = gitHubUrlParse(sourceControlUrl);
            const actionWorkflowRunsParams: GetActionsListWorkflowRunsParams = {
                owner: nonNullValue(ownerOrOrganization),
                repo: nonNullValue(repositoryName),
                branch: sourceControlBranch ?? 'main',
                page: -1,
            };

            context.errorHandling.suppressDisplay = true;
            return await getActions(context, actionWorkflowRunsParams);
        });

        if (actionsListWorkflowRuns?.total_count) {
            return actionsListWorkflowRuns.workflow_runs.map((awr) => new ActionTreeItem(this.id, this.contextValueExtensionPrefix, awr));
        } else if (sourceControlUrl) {
            // If we are able to detect a connection but fail to retrieve a list of actions, return 'noActionsDetected'
            return [
                createGenericElement({
                    contextValue: 'noActionsDetected',
                    id: `${this.parentId}/noActionsDetected`,
                    label: l10n.t('No actions detected'),
                })
            ];
        } else {
            let command: ConnectToGitHubCommand | undefined;
            if (this.getConnectToGitHubCommand) {
                command = await this.getConnectToGitHubCommand();
            }

            return [
                createGenericElement({
                    contextValue: 'connectToGitHub',
                    id: `${this.parentId}/connectToGitHub`,
                    label: l10n.t('Connect to a GitHub Repository...'),
                    commandId: command?.commandId,
                    commandArgs: command?.commandArgs
                })
            ];
        }
    }

    public getSourceControlBranch?(): Promise<string | undefined>;
    public getConnectToGitHubCommand?(): Promise<ConnectToGitHubCommand>;

    abstract getSourceControlUrl(): Promise<string | undefined>;
}
