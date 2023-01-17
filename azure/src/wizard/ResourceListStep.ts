/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IActionContext, IAzureQuickPickItem, IAzureQuickPickOptions, ITreeItemPickerContext, IWizardOptions, nonNullValue } from "@microsoft/vscode-azext-utils";
import { commands } from "vscode";
import { localize } from "vscode-nls";

export interface GenericListStepContext<TResource> extends IActionContext {
    /**
     * Call this to auto select the passed resource and not show the quick pick.
     *
     * @param resource Resource to auto select
     */
    autoSelectResource: (resource: TResource) => never;
}

export type CommandPick = { label: string, data: 'command', commandId: string, commandArgs?: unknown[] };

export type ResourceListPick<TResource> = CommandPick | IAzureQuickPickItem<TResource>;

export interface ResourceListStepConfig extends IAzureQuickPickOptions {
    /**
     * If true, the 'Create...' pick will not be shown. Overrides `wizardContext.suppressCreate`.
     */
    suppressCreatePick?: boolean;
}

export interface ResourceListCreateOptions<TContext extends IActionContext> {
    getSubWizard: (wizardContext: TContext) => Promise<IWizardOptions<TContext>>;
    resourceLabel: string;
}

/**
 * Base class for a wizard step that shows a quick pick list of resources.
 */
export abstract class ResourceListStep<TContext extends ITreeItemPickerContext, TResource, CanPickMany extends boolean = false> extends AzureWizardPromptStep<TContext> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private getSubWizardTask?: (context: TContext) => Promise<IWizardOptions<TContext>>;
    private createOptions?: ResourceListCreateOptions<TContext>;
    constructor(protected readonly config?: ResourceListStepConfig & { canPickMany?: CanPickMany }) {
        super();
        if (config?.canPickMany) {
            config.suppressCreatePick = true;
        }
        this.createOptions = this.create?.();
    }

    /**
     * Define this to add a 'Create...' pick to the quick pick list
     */
    create?(): ResourceListCreateOptions<TContext>;

    abstract onPickResource(wizardContext: TContext, resource: CanPickMany extends true ? TResource[] : TResource): Promise<void> | void;
    abstract getQuickPicks(wizardContext: GenericListStepContext<TResource> & TContext): Promise<ResourceListPick<TResource>[]>;
    abstract shouldPrompt(wizardContext: TContext): boolean;

    async prompt(wizardContext: TContext): Promise<void> {
        try {
            const pick: ResourceListPick<TResource | 'createPick'> = await wizardContext.ui.showQuickPick(this.getPicksInternal(wizardContext), {
                ...(this.config ?? {}),
            });

            if (isCommandPick(pick)) {
                this.getSubWizardTask = async () => ({
                    promptSteps: [
                        new CommandStep(pick.commandId, pick.commandArgs),
                        this,
                    ],
                });
            } else if (pick.data === 'createPick') {
                this.getSubWizardTask = nonNullValue(this.createOptions).getSubWizard;
            } else {
                const pickedResources = (Array.isArray(pick) ? (pick as IAzureQuickPickItem<TResource>[]).map(p => p.data) : pick.data) as CanPickMany extends true ? TResource[] : TResource;
                await this.onPickResource(wizardContext, pickedResources);
                this.getSubWizardTask = undefined;
            }
        } catch (e) {
            if (e instanceof AutoSelectError) {
                wizardContext.telemetry.properties.autoSelected = 'true';
                await this.onPickResource(wizardContext, e.data);
                return;
            } else {
                throw e;
            }
        }
    }

    async getSubWizard(wizardContext: TContext): Promise<IWizardOptions<TContext> | undefined> {
        if (this.getSubWizardTask) {
            return await this.getSubWizardTask(wizardContext);
        } else {
            return undefined;
        }
    }

    private async getPicksInternal(wizardContext: TContext): Promise<ResourceListPick<TResource | 'createPick'>[]> {
        const picks: ResourceListPick<TResource | 'createPick'>[] = await this.getQuickPicks({
            ...wizardContext,
            autoSelectResource: (resource) => {
                throw new AutoSelectError(resource);
            },
        });

        if (!this.config?.suppressCreatePick && !wizardContext.suppressCreatePick && this.createOptions) {
            picks.push({
                label: localize('createNewResource', `$(add) Create new {0}`, this.createOptions.resourceLabel),
                data: 'createPick',
            });
        }

        return picks;
    }
}

class AutoSelectError<T> extends Error {
    public readonly data: T;
    constructor(data: T) {
        super();
        this.data = data;
    }
}

function isCommandPick(pick: IAzureQuickPickItem | unknown): pick is CommandPick {
    return (pick as IAzureQuickPickItem).data === 'command';
}

class CommandStep extends AzureWizardPromptStep<IActionContext> {
    public shouldPrompt(): boolean {
        return true;
    }
    constructor(private readonly commandId: string, private readonly commandArgs: unknown[] = []) {
        super();
    }

    public async prompt(): Promise<void> {
        await commands.executeCommand(this.commandId, ...this.commandArgs);
    }
}
