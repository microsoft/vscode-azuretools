/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, GenericTreeItem, nonNullProp, nonNullValue, randomUtils } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { TargetServiceTypeName } from "../../constants";
import { createLinkerClient } from "../linkerClient";
import { ICreateLinkerContext } from "./ICreateLinkerContext";

export class LinkerCreateStep extends AzureWizardExecuteStep<ICreateLinkerContext>{
    public priority: number = 850;

    public async execute(context: ICreateLinkerContext): Promise<void> {
        const client = await createLinkerClient(context);

        context.linker = {
            authInfo: context.authType,
            targetService: {
                type: "AzureResource",
                id: this.getSourceResourceId(context),
            },
            scope: context.scope,
            clientType: context.clientType
        };

        await client.linker.beginCreateOrUpdateAndWait(nonNullValue(context.sourceResourceUri), nonNullValue(context.linkerName), context.linker);
        const config = await client.linker.listConfigurations(nonNullValue(context.sourceResourceUri), nonNullValue(context.linkerName));

        context.activityChildren = [];
        for (const item of nonNullProp(config, 'configurations')) {
            context.activityChildren.push(new GenericTreeItem(undefined, {
                contextValue: `createResult-` + randomUtils.getRandomHexString(3),
                label: `Added application setting: ${nonNullProp(item, 'name')}`,

            }));
        }
    }

    public shouldExecute(context: ICreateLinkerContext): boolean {
        return !context.linker;
    }

    private getSourceResourceId(context: ICreateLinkerContext): string {
        switch (context.targetService?.group) {
            case TargetServiceTypeName.Storage:
                return nonNullValue(context.storageAccount?.id);
            case TargetServiceTypeName.CosmosDB:
                return nonNullValue(context.databaseAccount?.id);
            case TargetServiceTypeName.KeyVault:
                return nonNullValue(context.keyVaultAccount?.id);
            default:
                throw new Error(vscode.l10n.t('No target type found'));
        }
    }
}
