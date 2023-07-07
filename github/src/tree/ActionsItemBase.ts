/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { IActionContext, TreeElementBase, callWithTelemetryAndErrorHandling, createContextValue, createGenericElement, nonNullValue } from "@microsoft/vscode-azext-utils";
import { ThemeIcon, TreeItem, TreeItemCollapsibleState, l10n } from "vscode";
import { gitHubUrlParse } from "../utils/gitHubUrlParse";
import { ActionsListWorkflowRuns, GetActionsListWorkflowRunsParams, getActions } from "../wrappers/getActions";
import { ActionItem } from "./ActionItem";

export interface GitHubSourceControl {
    repoUrl: string;
    repoBranch?: string;
}

export interface ConnectToGitHubCommand {
    /**
     * The command id to call for initiating the setup of source control for the client extension.
     * The client extension should provide its own connect implementation to call.
     *
     * @example 'containerApps.connectToGitHub'
     */
    commandId: string;
    /**
     * The list of corresponding args to provide when the command is called
     */
    commandArgs: unknown[] | undefined;
}

/**
 * Base tree node for setting up and tracking GitHub Actions in the tree view.
 * Branching children will be automatically setup and included to track actions, jobs, and steps.
 */
export abstract class ActionsItemBase implements TreeElementBase {
    static readonly contextValueSuffix: string = 'ActionsItem';
    static readonly connectedContextValue: string = 'actionsConnected:true';
    static readonly unconnectedContextValue: string = 'actionsConnected:false';

    static readonly idSuffix: string = 'actions';

    /**
     * @param parentId A unique identifier corresponding to the id of the parent tree node
     * @param contextValueExtensionPrefix The extension prefix used in constructing context values for the 'ActionsItem'
     * and its children. Passing 'containerApps' becomes `containerApps${ActionsItemBase.contextValueSuffix}`.
     */
    constructor(readonly parentId: string, readonly contextValueExtensionPrefix: string) { }

    /**
     * Constructed using the format: `${this.parentId}/${ActionsTreeItemBase.idSuffix}`
     */
    readonly id: string = `${this.parentId}/${ActionsItemBase.idSuffix}`;
    readonly label: string = 'Actions';

    private getContextValue(isConnected: boolean): string {
        const actionsTreeItemContextValue: string = `${this.contextValueExtensionPrefix}${ActionsItemBase.contextValueSuffix}`;
        const values: string[] = [actionsTreeItemContextValue];

        values.push(isConnected ? ActionsItemBase.connectedContextValue : ActionsItemBase.unconnectedContextValue);
        return createContextValue(values);
    }

    async getTreeItem(): Promise<TreeItem> {
        const isConnected: boolean = !!await this.getSourceControl();
        return {
            id: this.id,
            label: this.label,
            description: isConnected ? l10n.t('Connected') : '',
            iconPath: new ThemeIcon('github-inverted'),
            contextValue: this.getContextValue(isConnected),
            collapsibleState: TreeItemCollapsibleState.Collapsed,
        };
    }

    async getChildren(): Promise<TreeElementBase[]> {
        const sourceControl: GitHubSourceControl | undefined = await this.getSourceControl();

        const actionsListWorkflowRuns: ActionsListWorkflowRuns | undefined = await callWithTelemetryAndErrorHandling('getActionsChildren', async (context: IActionContext) => {
            if (!sourceControl) {
                return undefined;
            }

            const { ownerOrOrganization, repositoryName } = gitHubUrlParse(sourceControl.repoUrl);
            const actionWorkflowRunsParams: GetActionsListWorkflowRunsParams = {
                owner: nonNullValue(ownerOrOrganization),
                repo: nonNullValue(repositoryName),
                branch: sourceControl.repoBranch ?? 'main',
                page: 1,
            };

            context.errorHandling.suppressDisplay = true;
            return await getActions(context, actionWorkflowRunsParams);
        });

        if (actionsListWorkflowRuns?.total_count) {
            return actionsListWorkflowRuns.workflow_runs.map((awr) => new ActionItem(this.id, this.contextValueExtensionPrefix, awr));
        } else if (sourceControl) {
            // If we are able to detect a connection but fail to retrieve a list of actions
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

    /**
     * An optional method that the client extension may provide to initiate connection to a GitHub repository.
     *
     * The 'ActionsTreeItem' will display a generic tree item when no connection is detected (e.g. 'Connect to a GitHub Repository...').
     * This tree item becomes an entrypoint for initiating a source control connection.
     *
     * When no method is supplied, clicking on the generic tree item does nothing.
     */
    getConnectToGitHubCommand?(): Promise<ConnectToGitHubCommand>;

    /**
     * A required method for obtaining the connected GitHub repository's data.
     * If no repository is connected, return undefined.
     */
    abstract getSourceControl(): Promise<GitHubSourceControl | undefined>;
}
