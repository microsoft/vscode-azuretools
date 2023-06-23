/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AzureWizardPromptStep, IActionContext, TreeElementBase, TreeItemIconPath } from "@microsoft/vscode-azext-utils";
import type { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import type { TreeItem } from "vscode";

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
    static readonly contextValueSuffix: string;
    static readonly contextValueConnected: string;
    static readonly contextValueUnconnected: string;

    static readonly idSuffix: string;

    /**
     * The extension prefix used in constructing context values for the 'ActionsItem' and its children
     * @example passing 'containerApps' becomes `containerApps${ActionsItemBase.contextValueSuffix}`
     */
    readonly contextValueExtensionPrefix: string;

    /**
     * Constructed using the format: `${this.parentId}/${ActionsTreeItemBase.idSuffix}`
     */
    readonly id: string;

    /**
     * A unique identifier corresponding to the id of the parent tree node
     */
    readonly parentId: string;
    readonly label: string;

    constructor(parentId: string, contextValueExtensionPrefix: string);

    getTreeItem(): Promise<TreeItem>;
    getChildren(): Promise<TreeElementBase[]>;

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

/**
 * Used to prompt the user for the repository's GitHub organization
 * @populates gitHubOrg
 */
export declare class GitHubOrgListStep extends AzureWizardPromptStep<GitHubContext> {
    prompt(context: GitHubContext): Promise<void>;
    shouldPrompt(context: GitHubContext): boolean;
}

/**
 * Used to prompt the user for the GitHub repository
 * @prerequisites gitHubOrg
 * @populates gitHubRepository, gitHubRepositoryOwner, gitHubRepositoryUrl
 */
export declare class GitHubRepositoryListStep extends AzureWizardPromptStep<GitHubContext> {
    prompt(context: GitHubContext): Promise<void>;
    shouldPrompt(context: GitHubContext): boolean;
}

/**
 * Used to prompt the user for the GitHub repository
 * @prerequisites gitHubRepository, gitHubRepositoryOwner
 * @populates gitHubBranch
 */
export declare class GitHubBranchListStep extends AzureWizardPromptStep<GitHubContext> {
    prompt(context: GitHubContext): Promise<void>;
    shouldPrompt(context: GitHubContext): boolean;
}

export interface GitHubContext extends IActionContext {
    gitHubAccessToken?: string;

    // Organization
    gitHubOrg?: string;

    // Repository
    gitHubRepository?: string;
    gitHubRepositoryOwner?: string;
    gitHubRepositoryUrl?: string;

    // Branch
    gitHubBranch?: string;
}

export declare function getGitHubAccessToken(): Promise<string>;

/**
 * Can be used to initialize a new Octokit client.
 *
 * Note: Typically does not need to be called directly by client extensions
 * unless implementing a custom behavior.
 */
export declare function createOctokitClient(context: GitHubContext): Promise<Octokit>;

/**
 * A wrapper for Octokit's: `client.users.getAuthenticated`
 */
export declare function getAuthenticatedUser(context: GitHubContext): Promise<AuthenticatedUser>;
export type AuthenticatedUser = RestEndpointMethodTypes["users"]["getAuthenticated"]["response"]["data"];

/**
 * A wrapper for Octokit's: `client.orgs.listForAuthenticatedUser`
 */
export declare function getOrgs(context: GitHubContext): Promise<Orgs>;
export type Orgs = RestEndpointMethodTypes["orgs"]["listForAuthenticatedUser"]["response"]["data"];

/**
 * A wrapper for Octokit's: `client.repos.listForAuthenticatedUser`
 */
export declare function getRepositoriesByUser(context: GitHubContext, reqParams?: GetUserReposReqParams): Promise<UserRepos>;
export type UserRepos = RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["response"]["data"];
export type GetUserReposReqParams = RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["parameters"];

/**
 * A wrapper for Octokit's: `client.repos.listForOrg`
 */
export declare function getRepositoriesByOrg(context: GitHubContext, reqParams: GetOrgReposReqParams): Promise<OrgRepos>;
export type OrgRepos = RestEndpointMethodTypes["repos"]["listForOrg"]["response"]["data"];
export type GetOrgReposReqParams = RestEndpointMethodTypes["repos"]["listForOrg"]["parameters"] & { org: string };

/**
 * A wrapper for Octokit's: `client.repos.listBranches`
 */
export declare function getBranches(context: GitHubContext, reqParams: GetBranchesParams): Promise<Branches>;
export type Branches = RestEndpointMethodTypes["repos"]["listBranches"]["response"]["data"];
export type GetBranchesParams = RestEndpointMethodTypes["repos"]["listBranches"]["parameters"] & { owner: string; repo: string };

/**
 * A wrapper for Octokit's: `client.actions.listWorkflowRunsForRepo`
 */
export declare function getActions(context: GitHubContext, params?: GetActionsListWorkflowRunsParams): Promise<ActionsListWorkflowRuns>;
export type ActionsListWorkflowRuns = RestEndpointMethodTypes["actions"]["listWorkflowRunsForRepo"]["response"]["data"];
export type ActionWorkflowRuns = ActionsListWorkflowRuns["workflow_runs"][number];
export type GetActionsListWorkflowRunsParams = RestEndpointMethodTypes["actions"]["listWorkflowRunsForRepo"]["parameters"];

/**
 * A wrapper for Octokit's: `client.actions.listJobsForWorkflowRun`
 */
export declare function getJobs(context: GitHubContext, params: GetJobsParams): Promise<Jobs>;
export type Jobs = RestEndpointMethodTypes["actions"]["listJobsForWorkflowRun"]["response"]["data"];
export type Job = Jobs["jobs"][number];
export type JobStep = NonNullable<Job["steps"]>[number];
export type GetJobsParams = RestEndpointMethodTypes["actions"]["listJobsForWorkflowRun"]["parameters"];

export interface ParsedGitHubUrl {
    /**
     * The original URL for reference
     * @example 'https://github.com/microsoft/foo-bar'
     */
    urlReference?: string;

    /**
     * The owner or organization, parsed from the full GitHub URL
     * @example 'microsoft'
     */
    ownerOrOrganization?: string;

    /**
     * The repository (base), parsed from the full GitHub URL
     * @example 'foo-bar'
     */
    repositoryName?: string;
}

/**
 * A minimal utility function for parsing a full GitHub URL into its constituent parts
 * @params url A complete GitHub repository URL
 * @example 'https://github.com/microsoft/foo-bar'
 */
export declare function gitHubUrlParse(url?: string): ParsedGitHubUrl;

/**
 * GitHub 'Check Run' - final conclusion of the check
 */
export enum Conclusion {
    Success = 'success',
    Failure = 'failure',
    Skipped = 'skipped',
    Cancelled = 'cancelled'
}

/**
 * GitHub 'Check Run' - current status of the check
 */
export enum Status {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed'
}

/**
 * Get a tree item description based on its Job-related status.
 *
 * Note: Typically does not need to be called directly by client extensions
 * unless implementing a custom experience.
 */
export function getJobBasedDescription(data: Job | JobStep): string;

/**
 * Select an icon based on its Action-related status.
 *
 * Note: Typically does not need to be called directly by client extensions
 * unless implementing a custom experience.
 */
export function getActionBasedIconPath(data: ActionWorkflowRuns | Job | JobStep): TreeItemIconPath;
