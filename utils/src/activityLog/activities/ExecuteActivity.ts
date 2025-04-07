/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as hTypes from '../../../hostapi';
import * as types from '../../../index';
import { activityFailContext, activityFailIcon } from '../../constants';
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
            getChildren: activityResult || this.context.activityChildren ? ((_parent: types.ActivityItemBase) => {

                if (this.context.activityChildren) {
                    return this.context.activityChildren;
                }

                const ti = createGenericElement({
                    contextValue: 'executeResult',
                    label: vscode.l10n.t("Click to view resource"),
                    commandId: 'azureResourceGroups.revealResource',
                    commandArgs: [resourceId],
                });

                return [ti];

            }) : undefined
        }
    }

    public errorState(error: types.IParsedError): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
            getChildren: (_parent: types.ActivityItemBase) => {
                const errorItem = createGenericElement({
                    contextValue: 'executeError',
                    label: error.message
                });

                if (this.context.activityChildren) {
                    this.appendErrorItemToActivityChildren(errorItem);
                    return this.context.activityChildren;
                }

                return [errorItem];
            }
        }
    }

    public progressState(): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
            getChildren: this.context.activityChildren ? ((_parent: types.ActivityItemBase) => {
                return this.context.activityChildren || [];
            }) : undefined
        }
    }

    private appendErrorItemToActivityChildren(errorItem: types.ActivityItemBase): void {
        // Honor any error suppression flag
        if ((this.context as unknown as types.IActionContext).errorHandling?.suppressDisplay) {
            return;
        }

        // Check if the last activity child was a parent fail item; if so, attach the actual error to it for additional user context
        const lastActivityChild = this.context.activityChildren?.at(-1);
        const previousGetChildrenImpl = lastActivityChild?.getChildren?.bind(lastActivityChild) as types.TreeElementBase['getChildren'];
        if (
            lastActivityChild &&
            previousGetChildrenImpl &&
            new RegExp(activityFailContext).test(lastActivityChild.contextValue ?? '')
        ) {
            lastActivityChild.getChildren = async () => {
                return [
                    ...await previousGetChildrenImpl() ?? [],
                    errorItem
                ];
            }
            return;
        }

        // Otherwise append error item to the end of the list
        errorItem.iconPath = activityFailIcon;
        this.context.activityChildren?.push(errorItem);
    }

    protected get label(): string {
        return this.context.activityTitle ?? vscode.l10n.t("Azure Activity");
    }
}
