/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { AppKind, WebsiteOS } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

interface ILinuxRuntimeStack {
    name: string;
    displayName: string;
}

export class SiteRuntimeStep extends AzureWizardPromptStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext): Promise<void> {
        if (wizardContext.newSiteKind === AppKind.functionapp) {
            const runtimeItems: IAzureQuickPickItem<string>[] = [
                { label: 'JavaScript', data: 'node' },
                { label: '.NET', data: 'dotnet' }
            ];

            if (wizardContext.newSiteOS === WebsiteOS.linux) {
                runtimeItems.push({ label: 'Python', description: '(Preview)', data: 'python' });
            } else {
                runtimeItems.push({ label: 'Java', data: 'java' });
            }

            wizardContext.newSiteRuntime = (await ext.ui.showQuickPick(runtimeItems, { placeHolder: 'Select a runtime for your new app.' })).data;
        } else if (wizardContext.newSiteOS === WebsiteOS.linux) {
            let runtimeItems: IAzureQuickPickItem<ILinuxRuntimeStack>[] = this.getLinuxRuntimeStack().map((rt: ILinuxRuntimeStack) => {
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

    // tslint:disable-next-line:max-func-body-length
    private getLinuxRuntimeStack(): ILinuxRuntimeStack[] {
        return [
            {
                name: 'node|10.10',
                displayName: 'Node.js 10.10 (LTS - Recommended for new apps)'
            },
            {
                name: 'node|4.4',
                displayName: 'Node.js 4.4'
            },
            {
                name: 'node|4.5',
                displayName: 'Node.js 4.5'
            },
            {
                name: 'node|6.2',
                displayName: 'Node.js 6.2'
            },
            {
                name: 'node|6.6',
                displayName: 'Node.js 6.6'
            },
            {
                name: 'node|6.9',
                displayName: 'Node.js 6.9'
            },
            {
                name: 'node|6.10',
                displayName: 'Node.js 6.10'
            },
            {
                name: 'node|6.11',
                displayName: 'Node.js 6.11'
            },
            {
                name: 'node|8.0',
                displayName: 'Node.js 8.0'
            },
            {
                name: 'node|8.1',
                displayName: 'Node.js 8.1'
            },
            {
                name: 'node|8.2',
                displayName: 'Node.js 8.2'
            },
            {
                name: 'node|8.8',
                displayName: 'Node.js 8.8'
            },
            {
                name: 'node|8.9',
                displayName: 'Node.js 8.9'
            },
            {
                name: 'node|9.4',
                displayName: 'Node.js 9.4'
            },
            {
                name: 'node|10.1',
                displayName: 'Node.js 10.1'
            },
            {
                name: 'node|10.14',
                displayName: 'Node.js 10.14'
            },
            {
                name: 'php|5.6',
                displayName: 'PHP 5.6'
            },
            {
                name: 'php|7.0',
                displayName: 'PHP 7.0'
            },
            {
                name: 'php|7.2',
                displayName: 'PHP 7.2'
            },
            {
                name: 'dotnetcore|1.0',
                displayName: '.NET Core 1.0'
            },
            {
                name: 'dotnetcore|1.1',
                displayName: '.NET Core 1.1'
            },
            {
                name: 'dotnetcore|2.0',
                displayName: '.NET Core 2.0'
            },
            {
                name: 'dotnetcore|2.1',
                displayName: '.NET Core 2.1'
            },
            {
                name: 'dotnetcore|2.2',
                displayName: '.NET Core 2.2'
            },
            {
                name: 'ruby|2.3',
                displayName: 'Ruby 2.3'
            },
            {
                name: 'tomcat|8.5-jre8',
                displayName: 'Tomcat 8.5 (Java 8)'
            },
            {
                name: 'tomcat|9.0-jre8',
                displayName: 'Tomcat 9.0 (Java 8)'
            },
            {
                name: 'java|8-jre8',
                displayName: 'Java SE (Java 8)'
            },
            {
                name: 'wildfly|14-jre8',
                displayName: '[Preview] WildFly 14 (Java 8)'
            },
            {
                name: 'tomcat|8.5-java11',
                displayName: 'Tomcat 8.5 (Java 11)'
            },
            {
                name: 'tomcat|9.0-java11',
                displayName: 'Tomcat 9.0 (Java 11)'
            },
            {
                name: 'java|11-java11',
                displayName: 'Java SE (Java 11)'
            },
            {
                name: 'python|3.7',
                displayName: '[Preview] Python 3.7'
            }
        ];
    }

    private sortQuickPicksByRuntime(runtimeItems: IAzureQuickPickItem<ILinuxRuntimeStack>[], recommendedRuntimes: string[]): IAzureQuickPickItem<ILinuxRuntimeStack>[] {
        function getPriority(item: IAzureQuickPickItem<ILinuxRuntimeStack>): number {
            const index: number = recommendedRuntimes.findIndex((runtime: string) => item.data.name.includes(runtime));
            return index === -1 ? recommendedRuntimes.length : index;
        }
        return runtimeItems.sort((a: IAzureQuickPickItem<ILinuxRuntimeStack>, b: IAzureQuickPickItem<ILinuxRuntimeStack>) => getPriority(a) - getPriority(b));
    }
}
