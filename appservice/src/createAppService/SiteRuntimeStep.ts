/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebResource } from 'ms-rest';
import * as request from 'request-promise';
import { workspace } from 'vscode';
import { appendExtensionUserAgent, AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { signRequest } from '../signRequest';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

interface ILinuxRuntimeStack {
    name: string;
    displayName: string;
    isDefault?: boolean;
}

type availableStacksJson = {
    value: [{
        properties: {
            majorVersions: [{
                runtimeVersion: string,
                displayVersion: string,
                isDefault?: boolean
            }]
        }
    }
    ]
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
            let runtimeItems: IAzureQuickPickItem<ILinuxRuntimeStack>[] = (await this.getLinuxRuntimeStack(wizardContext)).map((rt: ILinuxRuntimeStack) => {
                return {
                    id: rt.name,
                    label: rt.displayName,
                    description: '',
                    data: rt
                };
            });
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

    private async getLinuxRuntimeStack(wizardContext: IAppServiceWizardContext): Promise<ILinuxRuntimeStack[]> {
        const requestOptions: WebResource = new WebResource();
        requestOptions.headers = {
            ['User-Agent']: appendExtensionUserAgent()
        };
        const env = wizardContext.environment;
        console.log(env);
        requestOptions.url = `${wizardContext.environment.resourceManagerEndpointUrl}/providers/Microsoft.Web/availableStacks?osTypeSelected=Linux&api-version=2018-02-01'`;
        await signRequest(requestOptions, wizardContext.credentials);

        // tslint:disable-next-line no-unsafe-any
        const runtimes: string = await request(requestOptions).promise();

        // tslint:disable-next-line no-unsafe-any
        const runtimesParsed: availableStacksJson = JSON.parse(runtimes);
        return runtimesParsed.value.map((runtime) => {
            return runtime.properties.majorVersions.map((majorVersion) => {
                return { name: majorVersion.runtimeVersion, displayName: majorVersion.displayVersion, isDefault: majorVersion.isDefault };
            });
        }).reduce((acc, val) => acc.concat(val));
    }

    private sortQuickPicksByRuntime(runtimeItems: IAzureQuickPickItem<ILinuxRuntimeStack>[], recommendedRuntimes: string[]): IAzureQuickPickItem<ILinuxRuntimeStack>[] {
        function getPriority(item: IAzureQuickPickItem<ILinuxRuntimeStack>): number {
            const index: number = recommendedRuntimes.findIndex((runtime: string) => item.data.name.includes(runtime));
            return index === -1 ? recommendedRuntimes.length : index;
        }
        return runtimeItems.sort((a: IAzureQuickPickItem<ILinuxRuntimeStack>, b: IAzureQuickPickItem<ILinuxRuntimeStack>) => getPriority(a) - getPriority(b));
    }
}
