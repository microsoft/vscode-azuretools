/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { runWithTestActionContext, TestActionContext, TestInput } from '@microsoft/vscode-azext-dev';
import * as assert from 'assert';
import { contextValueExperience } from '../../src/treev2/quickPickWizard/experiences/contextValueExperience';
import { createContextValue } from '../../src/utils/contextUtils';
import { assertThrowsAsync } from '../assertThrowsAsync';
import { TestTreeDataProvider, TestTreeNode } from './TestTreeView';

suite.only('contextValueExperience', () => {

    const excludeContextValue = 'excludeContextValue';

    const subscription1Label = 'subscription-1';
    const subscriptionContextValues = ['subscription'];

    const azureFunction1 = 'azureFunction1';
    const azureFunction1Label = 'my-azure-function-1';
    const azureFunctionContextValues = ['azureFunction', 'azureResource'];

    const functionAppsGroupLabel = 'Function Apps';
    const functionAppsGroupId = 'functionAppsGroup';
    const functionAppsGroupContextValues = ['group', 'functions']

    const appServiceGroupLabel = 'Web Apps';

    const functionApp2Label = 'my-function-app-2';
    const functionApp2Id = 'functionApp2';

    const functionApp3Label = 'my-function-app-3';
    const functionApp3Id = 'functionApp3';

    const functionApp4Label = 'my-function-app-4';
    const functionApp4Id = 'functionApp4';

    const functionApp5Label = 'my-function-app-5';
    const functionApp5Id = 'functionApp5';

    const treeWithContextValues = (): TestTreeNode[] => ([
        {
            id: 'subscription-1',
            contextValue: createContextValue(subscriptionContextValues),
            label: subscription1Label,
            children: [
                {
                    id: functionAppsGroupId,
                    label: functionAppsGroupLabel,
                    contextValue: createContextValue(functionAppsGroupContextValues),
                    children: [
                        {
                            id: azureFunction1,
                            label: azureFunction1Label,
                            contextValue: createContextValue([...azureFunctionContextValues, excludeContextValue])
                        },
                        {
                            id: functionApp2Id,
                            label: functionApp2Label,
                            contextValue: createContextValue(azureFunctionContextValues),
                            children: [
                                {
                                    id: functionApp3Id,
                                    label: functionApp3Label,
                                    contextValue: createContextValue(azureFunctionContextValues),
                                }
                            ],
                        },
                        {
                            id: functionApp4Id,
                            label: functionApp4Label,
                            contextValue: 'someOtherContextValue',
                            children: [
                                {
                                    id: functionApp5Id,
                                    label: functionApp5Label,
                                    contextValue: createContextValue(azureFunctionContextValues),
                                }
                            ],
                        }
                    ],
                },
                {
                    id: 'appServiceGroup',
                    label: appServiceGroupLabel,
                    contextValue: createContextValue(['group', 'appService']),
                    children: []
                },
            ]
        }
    ]);

    test('Pick nested tree item', async () => {
        await runWithTestActionContext(('contextValueExperienceTest'), async (context: TestActionContext) => {
            const tdp = TestTreeDataProvider(treeWithContextValues());
            await context.ui.runWithInputs([subscription1Label, functionAppsGroupLabel, azureFunction1Label], async () => {
                const pick = await contextValueExperience<TestTreeNode>(context, tdp, {
                    include: azureFunctionContextValues
                });
                assert.equal(pick.id, azureFunction1);
            });
        });
    });

    test('Exclude tree items that match exclude context values', async () => {
        await runWithTestActionContext(('contextValueExperienceTest'), async (context: TestActionContext) => {
            const tdp = TestTreeDataProvider(treeWithContextValues());
            await context.ui.runWithInputs([subscription1Label, functionAppsGroupLabel, azureFunction1Label], async () => {
                await assertNoMatchingQuickPickItem(async () => {
                    await contextValueExperience<TestTreeNode>(context, tdp, {
                        include: azureFunctionContextValues,
                        exclude: [excludeContextValue]
                    });
                });
            });
        });
    });

    test('Pick a tree item that has children', async () => {
        await runWithTestActionContext(('contextValueExperienceTest'), async (context: TestActionContext) => {
            const tdp = TestTreeDataProvider(treeWithContextValues());
            await context.ui.runWithInputs([subscription1Label, functionAppsGroupLabel], async () => {
                const pick = await contextValueExperience<TestTreeNode>(context, tdp, {
                    include: functionAppsGroupContextValues
                });
                assert.equal(pick.id, functionAppsGroupId);
            });
        });
    });

    test('Tree item that is both a final and ancestor pick is shown as a final pick', async () => {
        await runWithTestActionContext(('contextValueExperienceTest'), async (context: TestActionContext) => {
            const tdp = TestTreeDataProvider(treeWithContextValues());
            await context.ui.runWithInputs([subscription1Label, functionAppsGroupLabel, functionApp2Label], async () => {
                const pick = await contextValueExperience<TestTreeNode>(context, tdp, {
                    include: azureFunctionContextValues
                });
                assert.equal(pick.id, functionApp2Id);
            });
        });
    });

    test('Ensure only final picks are shown if there are final and indirect picks available', async () => {
        await runWithTestActionContext(('contextValueExperienceTest'), async (context: TestActionContext) => {
            const tdp = TestTreeDataProvider(treeWithContextValues());
            await context.ui.runWithInputs([subscription1Label, functionAppsGroupLabel, functionApp4Label], async () => {
                await assertNoMatchingQuickPickItem(async () => {
                    await contextValueExperience<TestTreeNode>(context, tdp, {
                        include: azureFunctionContextValues
                    });
                })
            });
        });
    });

    test('Pick nested tree item allows using the back button', async () => {
        await runWithTestActionContext(('contextValueExperienceTest'), async (context: TestActionContext) => {
            const tdp = TestTreeDataProvider(treeWithContextValues());
            await context.ui.runWithInputs([subscription1Label, functionAppsGroupLabel, TestInput.BackButton, functionAppsGroupLabel, azureFunction1Label], async () => {
                const pick = await contextValueExperience<TestTreeNode>(context, tdp, {
                    include: azureFunctionContextValues
                });
                assert.equal(pick.id, azureFunction1);
            });
        });
    });

    test('Back button actually goes back', async () => {
        await runWithTestActionContext(('contextValueExperienceTest'), async (context: TestActionContext) => {
            const tdp = TestTreeDataProvider(treeWithContextValues());
            await context.ui.runWithInputs([subscription1Label, functionAppsGroupLabel, TestInput.BackButton, azureFunction1Label], async () => {
                await assertNoMatchingQuickPickItem(async () => {
                    await contextValueExperience<TestTreeNode>(context, tdp, {
                        include: azureFunctionContextValues
                    });
                });
            });
        });
    });

    test('Back button can be used when there are no matching resources', async () => {
        await runWithTestActionContext(('contextValueExperienceTest'), async (context: TestActionContext) => {
            const tdp = TestTreeDataProvider(treeWithContextValues());
            await context.ui.runWithInputs([subscription1Label, appServiceGroupLabel, TestInput.BackButton, functionAppsGroupLabel, azureFunction1Label], async () => {
                const pick = await contextValueExperience<TestTreeNode>(context, tdp, {
                    include: azureFunctionContextValues
                });
                assert.equal(pick.id, azureFunction1);
            });
        });
    });
});

function assertNoMatchingQuickPickItem(block: () => Promise<void>): Promise<void> {
    const noMatchingQuickPickItem = /Did not find quick pick item matching/;
    return assertThrowsAsync(block, noMatchingQuickPickItem);
}
