/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ApplicationStack } from 'azure-arm-website/lib/models';
import { WebResource } from 'ms-rest';
import * as request from 'request-promise';
import { workspace } from 'vscode';
import { appendExtensionUserAgent, AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { signRequest } from '../signRequest';
import { nonNullProp } from '../utils/nonNull';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

type ApplicationStackJsonResponse = {
    value: [{
        properties: ApplicationStack
    }]
};

export class SiteRuntimeStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        if (wizardContext.newSiteKind === AppKind.functionapp) {
            const runtimeItems: IAzureQuickPickItem<string>[] = [
                { label: 'JavaScript', data: 'node' },
                { label: '.NET', data: 'dotnet' }
            ];

            const previewDescription: string = localize('previewDescription', '(Preview)');
            if (wizardContext.newSiteOS === WebsiteOS.linux) {
                runtimeItems.push({ label: 'Python', description: previewDescription, data: 'python' });
            } else {
                runtimeItems.push({ label: 'Java', data: 'java' });
                if (workspace.getConfiguration().get('azureFunctions.enablePowerShell')) {
                    runtimeItems.push({ label: 'PowerShell', description: previewDescription, data: 'powershell' });
                }
            }

            wizardContext.newSiteRuntime = (await ext.ui.showQuickPick(runtimeItems, { placeHolder: 'Select a runtime for your new app.' })).data;
        } else if (wizardContext.newSiteOS === WebsiteOS.linux) {
            let runtimeItems: IAzureQuickPickItem<ApplicationStack>[] = (await this.getLinuxRuntimeStack(wizardContext)).map((rt: ApplicationStack) => {
                return {
                    id: nonNullProp(rt, 'name'),
                    label: nonNullProp(rt, 'display'),
                    description: '',
                    data: rt
                };
            });

            // filters out Node 4.x and 6.x as they are EOL
            runtimeItems = runtimeItems.filter(qp => !/node\|(4|6)\./i.test(nonNullProp(qp.data, 'name')));
            // tslint:disable-next-line:strict-boolean-expressions
            if (wizardContext.recommendedSiteRuntime) {
                runtimeItems = this.sortQuickPicksByRuntime(runtimeItems, wizardContext.recommendedSiteRuntime);
            }
            wizardContext.newSiteRuntime = (await ext.ui.showQuickPick(runtimeItems, { placeHolder: 'Select a runtime for your new Linux app.' })).data.name;
        }
    }

    public shouldPrompt(wizardContext: IAppServiceWizardContext): boolean {
        return !wizardContext.newSiteRuntime && !(wizardContext.newSiteKind === AppKind.app && wizardContext.newSiteOS === WebsiteOS.windows);
    }

    // the sdk has a bug that doesn't retrieve the full response for provider.getAvailableStacks(): https://github.com/Azure/azure-sdk-for-node/issues/5068
    private async getLinuxRuntimeStack(wizardContext: IAppServiceWizardContext): Promise<ApplicationStack[]> {
        const requestOptions: WebResource = new WebResource();
        requestOptions.headers = {
            ['User-Agent']: appendExtensionUserAgent()
        };

        requestOptions.url = `${wizardContext.environment.resourceManagerEndpointUrl}providers/Microsoft.Web/availableStacks?osTypeSelected=Linux&api-version=2018-02-01`;
        await signRequest(requestOptions, wizardContext.credentials);
        // tslint:disable-next-line no-unsafe-any
        const runtimes: string = <string>(await request(requestOptions).promise());

        const runtimesParsed: ApplicationStackJsonResponse = <ApplicationStackJsonResponse>JSON.parse(runtimes);

        return runtimesParsed.value.map((runtime) => {
            return nonNullProp(runtime.properties, 'majorVersions').sort((rt1, rt2) => {
                if (rt1.isDefault) {
                    return -1;
                } else if (rt2.isDefault) {
                    return 1;
                } else {
                    // runtimVersion comes in the format RUNTIME|X.X
                    const runtimeRegExp: RegExp = /.*(?=\|)+./g;
                    const v1: number = parseFloat(nonNullProp(rt1, 'runtimeVersion').replace(runtimeRegExp, ''));
                    const v2: number = parseFloat(nonNullProp(rt2, 'runtimeVersion').replace(runtimeRegExp, ''));
                    return v2 - v1;
                }
            }).map((majorVersion) => {
                return { name: majorVersion.runtimeVersion, display: majorVersion.displayVersion, isDefault: majorVersion.isDefault };
            });
        }).reduce((acc, val) => acc.concat(val));
        // this is to flatten the runtimes to one array
    }

    private sortQuickPicksByRuntime(runtimeQuickPicks: IAzureQuickPickItem<ApplicationStack>[], runtimeRecommendations: string[]): IAzureQuickPickItem<ApplicationStack>[] {
        const recommendedQuickPicks: IAzureQuickPickItem<ApplicationStack>[] = [];
        // go backwards so that when runtime is unshifted to front, the order is unaffected
        for (let i: number = runtimeQuickPicks.length - 1; i >= 0; i = i - 1) {
            for (const rt of runtimeRecommendations) {
                if (nonNullProp(runtimeQuickPicks[i].data, 'name').toLocaleLowerCase().includes(rt.toLocaleLowerCase())) {
                    recommendedQuickPicks.unshift(runtimeQuickPicks.splice(i, 1)[0]);
                }
            }
        }

        return recommendedQuickPicks.concat(runtimeQuickPicks);
    }
}
