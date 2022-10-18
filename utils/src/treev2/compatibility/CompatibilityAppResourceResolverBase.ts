/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AppResource, AppResourceResolver, ResolvedAppResourceBase } from "../../../hostapi";
import { Event, EventEmitter, ProviderResult } from "vscode";
import { ISubscriptionContext } from "../../..";

export abstract class CompatabilityAppResourceResolverBase implements AppResourceResolver {
    abstract resolveResource(subContext: ISubscriptionContext, resource: AppResource): ProviderResult<ResolvedAppResourceBase>;
    abstract matchesResource(resource: AppResource): boolean;

    private readonly onDidChangeTreeDataEmitter: EventEmitter<ResolvedAppResourceBase | undefined> = new EventEmitter<ResolvedAppResourceBase | undefined>();
    onDidChangeTreeData: Event<ResolvedAppResourceBase | undefined> = this.onDidChangeTreeDataEmitter.event;

    refresh(resource?: ResolvedAppResourceBase): void {
        this.onDidChangeTreeDataEmitter.fire(resource);
    }
}
