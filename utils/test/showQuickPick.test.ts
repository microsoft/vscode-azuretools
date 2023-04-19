/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Memento } from 'vscode';
import * as types from '../index';
import { createQuickPickItems } from '../src/userInput/showQuickPick';
import { randomUtils } from '../src/utils/randomUtils';

suite("showQuickPick", () => {
    suite("createQuickPickItems", () => {
        suite("sorting", () => {
            interface TestPick {
                label: string;
                priority?: types.AzureQuickPickItemPriority;
                suppressPersistance?: boolean;
            }


            class FakeMemento implements Memento {
                public fakeKeys = new Map<string, unknown>();


                keys(): readonly string[] {
                    return Object.keys(this.fakeKeys);
                }

                get<T>(key: string): T | undefined;
                get<T>(key: string, defaultValue: T): T;
                get<T>(key: any, defaultValue?: any): T | T | undefined {
                    return this.fakeKeys[key] ?? defaultValue;
                }
                async update(key: string, value: any): Promise<void> {
                    this.fakeKeys[key] = value;
                }

            }

            async function getrecentlyUsed(label: string): Promise<string> {
                return await randomUtils.getPseudononymousStringHash(label);
            }

            async function testSorting(
                options: {
                    input: TestPick[];
                    recentlyUsed?: string | undefined;
                    suppressPersistence?: boolean;
                    expected: string[]
                }
            ): Promise<void> {
                const input: types.IAzureQuickPickItem<string>[] = options.input.map(p => <types.IAzureQuickPickItem<string>>{
                    label: p.label,
                    data: p.label,
                    suppressPersistence: p.suppressPersistance,
                    priority: p.priority,
                });
                const fakeState = new FakeMemento();
                if (options.recentlyUsed) {
                    fakeState.fakeKeys[options.recentlyUsed] = await getrecentlyUsed(options.recentlyUsed);
                }

                // Execute
                const sortedPicks = await createQuickPickItems<types.IAzureQuickPickItem<string>>(
                    input,
                    {
                        suppressPersistence: options.suppressPersistence
                    },
                    [],
                    options.recentlyUsed,
                    fakeState);

                const actual = sortedPicks.map(p => `${p.label}${p.description ? ' ' + p.description : ''}`);
                assert.deepStrictEqual(actual, options.expected);
            }

            test("Empty", async () => {
                await testSorting({
                    input: [],
                    expected: []
                });
            });

            suite("Default priorities, no recently used", () => {
                test("Single item", async () => {
                    await testSorting({
                        input: [
                            { label: "a" }
                        ],
                        expected: ["a"]
                    });
                });

                test("Multiple items, order should not be changed (stable sort)", async () => {
                    await testSorting({
                        input: [
                            { label: "a" },
                            { label: "d" },
                            { label: "c" },
                            { label: "b" }
                        ],
                        expected: ["a", "d", "c", "b"]
                    });
                });
            });

            suite("Default priorities with recently used", () => {
                test("empty", async () => {
                    await testSorting({
                        input: [],
                        expected: []
                    })
                });
                test("recently used matches nothing", async () => {
                    await testSorting({
                        recentlyUsed: "a",
                        input: [
                            { label: "b" },
                            { label: "c" },
                        ],
                        expected: ["b", "c"]
                    })
                });
                test("single item", async () => {
                    await testSorting({
                        recentlyUsed: "a",
                        input: [
                            { label: "a" },
                        ],
                        expected: ["a (recently used)"]
                    })
                });
                test("matches first", async () => {
                    await testSorting({
                        recentlyUsed: "b",
                        input: [
                            { label: "b" },
                            { label: "a" },
                            { label: "c" },
                            { label: "d" },
                        ],
                        expected: ["b (recently used)", "a", "c", "d"]
                    })
                });
                test("matches later item, bumped to start", async () => {
                    await testSorting({
                        recentlyUsed: "a",
                        input: [
                            { label: "b" },
                            { label: "a" },
                            { label: "c" },
                        ],
                        expected: ["a (recently used)", "b", "c"]
                    })
                });
            });

            suite("All have highest priority", () => {
                test("No recent item, order should not be changed (stable sort)", async () => {
                    await testSorting({
                        input: [
                            { label: "a", priority: 'highest' },
                            { label: "d", priority: 'highest' },
                            { label: "c", priority: 'highest' },
                            { label: "b", priority: 'highest' }
                        ],
                        expected: ["a", "d", "c", "b"]
                    });
                });

                test("Sort should still occur if recently used doesn't match anything", async () => {
                    await testSorting({
                        recentlyUsed: "nomatch",
                        input: [
                            { label: "a", priority: 'highest' },
                            { label: "d", priority: 'highest' },
                            { label: "c", priority: 'highest' },
                            { label: "b", priority: 'highest' }
                        ],
                        expected: ["a", "d", "c", "b"]
                    });
                });

            });

            suite("Mix of priorities, no recently used", () => {
                test("Multiple items, high priority should be grouped together, order not changed within priority groups", async () => {
                    await testSorting({
                        input: [
                            { label: "p2a" },
                            { label: "p1a", priority: 'highest' },
                            { label: "p1b", priority: 'highest' },
                            { label: "p1c", priority: 'highest' },
                            { label: "p2b" },
                            { label: "p2c" },
                            { label: "p1d", priority: 'highest' },
                            { label: "p2d" },
                            { label: "p1e", priority: 'highest' },
                            { label: "p2e" },
                        ],
                        expected: ["p1a", "p1b", "p1c", "p1d", "p1e", "p2a", "p2b", "p2c", "p2d", "p2e"]
                    });
                });
            });

            test("Recently used should have description changed even if no sorting needed", async () => {
                await testSorting({
                    recentlyUsed: "p1",
                    input: [
                        { label: "p1" },
                    ],
                    expected: ["p1 (recently used)"]
                });
            });

            test("Recently used should not have description changed if persistence suppressed", async () => {
                await testSorting({
                    recentlyUsed: "p1",
                    suppressPersistence: true,
                    input: [
                        { label: "p1" },
                    ],
                    expected: ["p1"]
                });
            });

            test("Recently used should not have description changed if item's persistence suppressed", async () => {
                await testSorting({
                    recentlyUsed: "p1",
                    input: [
                        { label: "p1", suppressPersistance: true },
                    ],
                    expected: ["p1"]
                });
            });

            suite("Mix of priorities with recently used - high priority should be grouped together, order not changed within priority groups", () => {
                test("Recently used is first and low priority", async () => {
                    await testSorting({
                        recentlyUsed: "p2a",
                        input: [
                            { label: "p2a" },
                            { label: "p1a", priority: 'highest' },
                            { label: "p1b", priority: 'highest' },
                            { label: "p1c", priority: 'highest' },
                            { label: "p2b" },
                            { label: "p2c" },
                            { label: "p1d", priority: 'highest' },
                            { label: "p2d" },
                            { label: "p1e", priority: 'highest' },
                            { label: "p2e" },
                        ],
                        expected: ["p1a", "p1b", "p1c", "p1d", "p1e", "p2a (recently used)", "p2b", "p2c", "p2d", "p2e"]
                    });
                });

                test("Recently used is later and low priority, recently used should be first after high priority items", async () => {
                    await testSorting({
                        recentlyUsed: "p2a",
                        input: [
                            { label: "p2c" },
                            { label: "p1a", priority: 'highest' },
                            { label: "p1b", priority: 'highest' },
                            { label: "p1c", priority: 'highest' },
                            { label: "p2b" },
                            { label: "p1d", priority: 'highest' },
                            { label: "p2d" },
                            { label: "p1e", priority: 'highest' },
                            { label: "p2a" },
                            { label: "p2e" },
                        ],
                        expected: ["p1a", "p1b", "p1c", "p1d", "p1e", "p2a (recently used)", "p2c", "p2b", "p2d", "p2e"]
                    });
                });

                test("Recently used is first high priority", async () => {
                    await testSorting({
                        recentlyUsed: "p1a",
                        input: [
                            { label: "p2a" },
                            { label: "p1a", priority: 'highest' },
                            { label: "p1b", priority: 'highest' },
                            { label: "p1c", priority: 'highest' },
                            { label: "p2b" },
                            { label: "p2c" },
                            { label: "p1d", priority: 'highest' },
                            { label: "p2d" },
                            { label: "p1e", priority: 'highest' },
                            { label: "p2e" },
                        ],
                        expected: ["p1a (recently used)", "p1b", "p1c", "p1d", "p1e", "p2a", "p2b", "p2c", "p2d", "p2e"]
                    });
                });

                test("Recently used is later high priority, should be bumped to first", async () => {
                    await testSorting({
                        recentlyUsed: "p1c",
                        input: [
                            { label: "p2a" },
                            { label: "p1a", priority: 'highest' },
                            { label: "p1b", priority: 'highest' },
                            { label: "p1c", priority: 'highest' },
                            { label: "p2b" },
                            { label: "p2c" },
                            { label: "p1d", priority: 'highest' },
                            { label: "p2d" },
                            { label: "p1e", priority: 'highest' },
                            { label: "p2e" },
                        ],
                        expected: ["p1c (recently used)", "p1a", "p1b", "p1d", "p1e", "p2a", "p2b", "p2c", "p2d", "p2e"]
                    });
                });
            });

            test("If suppressPersistence, high priority items should be bumped but recently used not bumped", async () => {
                await testSorting({
                    recentlyUsed: "p2e",
                    suppressPersistence: true,
                    input: [
                        { label: "p2a" },
                        { label: "p1a", priority: 'highest' },
                        { label: "p1b", priority: 'highest' },
                        { label: "p1c", priority: 'highest' },
                        { label: "p2b" },
                        { label: "p2c" },
                        { label: "p1d", priority: 'highest' },
                        { label: "p2d" },
                        { label: "p1e", priority: 'highest' },
                        { label: "p2e" },
                    ],
                    expected: ["p1a", "p1b", "p1c", "p1d", "p1e", "p2a", "p2b", "p2c", "p2d", "p2e"]
                });

                await testSorting({
                    recentlyUsed: "p2e",
                    input: [
                        { label: "p2a" },
                        { label: "p1a", priority: 'highest' },
                        { label: "p1b", priority: 'highest' },
                        { label: "p1c", priority: 'highest' },
                        { label: "p2b" },
                        { label: "p2c" },
                        { label: "p1d", priority: 'highest' },
                        { label: "p2d" },
                        { label: "p1e", priority: 'highest' },
                        { label: "p2e", suppressPersistance: true },
                    ],
                    expected: ["p1a", "p1b", "p1c", "p1d", "p1e", "p2a", "p2b", "p2c", "p2d", "p2e"]
                });

            });
        });
    });
});
