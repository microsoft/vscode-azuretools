/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as hTypes from '../../../hostapi';
import * as types from '../../../index';
import { activityFailContext, activityFailIcon } from '../../constants';
import { ResourceGroupsItem } from '../../pickTreeItem/quickPickAzureResource/tempTypes';
import { createGenericElement } from '../../tree/v2/createGenericElement';
import { ActivityBase } from "../Activity";

export class ExecuteActivity<TContext extends types.ExecuteActivityContext = types.ExecuteActivityContext> extends ActivityBase<void> {

    public constructor(protected readonly context: TContext, task: types.ActivityTask<void>) {
        super(task);
    }

    public initialState(): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
        }
    }

    public successState(): hTypes.ActivityTreeItemOptions {
        const activityResult = this.context.activityResult;
        const resourceId: string | undefined = typeof activityResult === 'string' ? activityResult : activityResult?.id;
        return {
            label: this.label,
            getChildren: activityResult || this.context.activityChildren ? ((_parent: ResourceGroupsItem) => {

                if (this.context.activityChildren) {
                    return this.context.activityChildren;
                }

                return [
                    createGenericElement({
                        contextValue: 'executeResult',
                        label: vscode.l10n.t("Click to view resource"),
                        commandId: 'azureResourceGroups.revealResource',
                        commandArgs: [resourceId],
                    }),
                ];

            }) : undefined
        }
    }

    public errorState(error: types.IParsedError): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
            getChildren: (_parent: ResourceGroupsItem) => {
                const errorItemOptions: types.GenericElementOptions = {
                    contextValue: 'executeError',
                    label: error.message
                };

                if (this.context.activityChildren) {
                    // Operate on a copied array to ensure the operation remains idempotent
                    const activityChildren: types.ActivityChildItemBase[] = this.context.activityChildren.slice();
                    this.appendErrorItemToActivityChildren(activityChildren, errorItemOptions);
                    return activityChildren;
                }

                return [createGenericElement(errorItemOptions)];
            }
        }
    }

    public progressState(): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
            getChildren: this.context.activityChildren ? ((_parent: ResourceGroupsItem) => {
                return this.context.activityChildren || [];
            }) : undefined
        }
    }

    private appendErrorItemToActivityChildren(activityChildren: types.ActivityChildItemBase[], errorItemOptions: types.GenericElementOptions): void {
        // Honor any error suppression flag
        if ((this.context as unknown as types.IActionContext).errorHandling?.suppressDisplay) {
            return;
        }

        const lastActivityChild = activityChildren?.at(-1);
        // Skip if not writeable; we've already updated and locked `getChildren`
        if (!Object.getOwnPropertyDescriptor(lastActivityChild, 'getChildren')?.writable) {
            return;
        }

        // Check if the last activity child was a parent fail item; if so, attach the actual error to it for additional user context
        const previousGetChildrenImpl = lastActivityChild?.getChildren?.bind(lastActivityChild) as types.ActivityChildItemBase['getChildren'];
        if (
            lastActivityChild &&
            previousGetChildrenImpl &&
            new RegExp(activityFailContext).test(lastActivityChild.contextValue ?? '')
        ) {
            lastActivityChild.getChildren = async () => {
                return [
                    ...await previousGetChildrenImpl() ?? [],
                    createGenericElement(errorItemOptions)
                ];
            };

            // Freeze the `getChildren` method to prevent further modifications (make this operation idempotent)
            Object.defineProperty(lastActivityChild, 'getChildren', {
                writable: false,
                configurable: false
            });

            return;
        }

        // Otherwise append error item to the end of the list
        errorItemOptions.iconPath = activityFailIcon;
        activityChildren.push(createGenericElement(errorItemOptions));
    }

    protected get label(): string {
        return this.context.activityTitle ?? vscode.l10n.t("Azure Activity");
    }
}
