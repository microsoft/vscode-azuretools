/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as hTypes from '../../../hostapi';
import * as types from '../../../index';
import { AzExtParentTreeItem } from "../../tree/AzExtParentTreeItem";
import { GenericTreeItem } from "../../tree/GenericTreeItem";
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
            getChildren: activityResult ? ((parent: AzExtParentTreeItem) => {

                const ti = new GenericTreeItem(parent, {
                    contextValue: 'executeResult',
                    label: vscode.l10n.t("Click to view resource"),
                    commandId: 'azureResourceGroups.revealResource',
                });

                ti.commandArgs = [resourceId];

                return [ti];

            }) : undefined
        }
    }

    public errorState(error: types.IParsedError): hTypes.ActivityTreeItemOptions {
        return {
            label: this.label,
            getChildren: (parent: AzExtParentTreeItem) => {
                return [
                    new GenericTreeItem(parent, {
                        contextValue: 'executeError',
                        label: error.message
                    })
                ];
            }
        }
    }

    protected get label(): string {
        return this.context.activityTitle ?? vscode.l10n.t("Azure Activity");
    }
}
