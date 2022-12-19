/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createTestActionContext } from '@microsoft/vscode-azext-dev';
import * as assert from 'assert';
import { IActionContext, QuickPickWizardContext } from '../../index';
import { ContextValueFilterQuickPickOptions, ContextValueQuickPickStep } from '../../src/pickTreeItem/contextValue/ContextValueQuickPickStep';
import { getLastNode } from '../../src/pickTreeItem/getLastNode';
import { createContextValue } from '../../src/utils/contextUtils';
import { AzureWizard } from '../../src/wizard/AzureWizard';
import { assertNoMatchingQuickPickItem } from './assertNoMatchingQuickPickItem';
import { createTestTreeDataProvider, TestTreeNode } from './TestTreeView';

suite('ContextValueQuickPickStep tests', () => {

    const testContextValue = 'testContextValue';

    const node1Label = 'node1';
    const node2Label = 'node2';
    const nodeWithChildrenLabel = 'nodeWithChildren';

    const node1ContextValue = 'node1ContextValue';
    const node2ContextValue = 'node2ContextValue';

    const tree: TestTreeNode[] = [
        {
            label: node1Label,
            contextValue: createContextValue([testContextValue, node1ContextValue]),
        },
        {
            label: node2Label,
            contextValue: createContextValue([testContextValue, node2ContextValue]),
        },
        {
            label: nodeWithChildrenLabel,
            children: [
                {
                    label: 'node3-child1',
                },
                {
                    label: 'node3-child1',
                },
            ],
        },
    ];

    const tdp = createTestTreeDataProvider(tree);

    suite('Respect skipIfOne setting', () => {

        const stepOptions = {
            contextValueFilter: {
                include: node1ContextValue
            },
        }

        test("Don't skip step with single pick when skipIfOne is false", async () => {
            const step = new ContextValueQuickPickStep(tdp, {
                ...stepOptions,
                skipIfOne: false,
            });
            const context = await createTestActionContext();
            await context.ui.runWithInputs([new RegExp(node1Label)], async () => {
                const pick = await runWizardWithStep(step, context);
                assert.equal(pick.label, node1Label);
            });
        });

        test("Skip step with single pick when skipIfOne is true", async () => {
            const step = new ContextValueQuickPickStep(tdp, {
                ...stepOptions,
                skipIfOne: true,
            });
            const pick = await runWizardWithStep(step, await createTestActionContext());
            assert.equal(pick.label, node1Label);
        });
    });

    test('Ancestor picks are not shown if final picks are also available', async () => {
        const step = new ContextValueQuickPickStep(tdp, {
            contextValueFilter: {
                include: [testContextValue],
            },
        });

        const context = await createTestActionContext();
        const input = new RegExp(nodeWithChildrenLabel);
        await context.ui.runWithInputs([input], async () => {
            await assertNoMatchingQuickPickItem(async () => {
                await runWizardWithStep(step, context);
            });
        });
    });

    test('Exclude picks that match any context value in the exclude array', async () => {
        const step = new ContextValueQuickPickStep(tdp, {
            contextValueFilter: {
                include: [testContextValue],
                exclude: [node1ContextValue, node2ContextValue],
            },
        });

        const context = await createTestActionContext();
        await context.ui.runWithInputs([new RegExp(node1Label)], async () => {
            await assertNoMatchingQuickPickItem(async () => {
                await runWizardWithStep(step, context);
            });
        });
        await context.ui.runWithInputs([new RegExp(node2Label)], async () => {
            await assertNoMatchingQuickPickItem(async () => {
                await runWizardWithStep(step, context);
            });
        });
    });

    test('Final picks match any context value in the include array', async () => {
        const step = new ContextValueQuickPickStep(tdp, {
            contextValueFilter: {
                include: [node1ContextValue, node2ContextValue],
            },
        });

        const context = await createTestActionContext();
        // make sure both picks are available
        await context.ui.runWithInputs([new RegExp(node1Label)], async () => {
            const pick = await runWizardWithStep(step, context);
            assert.equal(pick.label, node1Label);
        });
        await context.ui.runWithInputs([new RegExp(node2Label)], async () => {
            const pick = await runWizardWithStep(step, context);
            assert.equal(pick.label, node2Label);
        });
    });
});

async function runWizardWithStep(step: ContextValueQuickPickStep<QuickPickWizardContext, ContextValueFilterQuickPickOptions>, context: IActionContext): Promise<TestTreeNode> {
    const wizardContext: QuickPickWizardContext = { ...context, pickedNodes: [] };

    const wizard = new AzureWizard(wizardContext, {
        promptSteps: [step],
    });

    await wizard.prompt();
    return getLastNode(wizardContext) as TestTreeNode;
}
