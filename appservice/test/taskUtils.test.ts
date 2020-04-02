/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Task } from 'vscode';
import { taskUtils } from '../src/utils/taskUtils';

suite("taskUtils", () => {
    test('getFsPathFromTask', () => {
        assert.equal(taskUtils.getFsPathFromTask(tasks.js.install), '/Users/erijiz/TestRepos/js1');
        assert.equal(taskUtils.getFsPathFromTask(tasks.other.global), undefined);
        assert.equal(taskUtils.getFsPathFromTask(tasks.other.workspace), undefined);
        assert.equal(taskUtils.getFsPathFromTask(tasks.other.actualGlobal), undefined);
        assert.equal(taskUtils.getFsPathFromTask(tasks.other.noScope), undefined);
    });

    suite('isTaskInScopeOfPath', () => {
        test('true', () => {
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.js.install, '/Users/erijiz/TestRepos/js1'), true);
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.js.install, '/Users/erijiz/TestRepos/js1/subfolder'), true);
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.js.install, '/Users/erijiz/TestRepos/js1/subfolder/sub2'), true);
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.js.install, '/Users/erijiz/TestRepos/js1/../js1/'), true);
        });

        test('false', () => {
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.js.install, '/Users/erijiz/TestRepos/cs1/'), false);
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.js.install, '/Users/erijiz/TestRepos/'), false);
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.js.install, '/Users/erijiz/TestRepos/js1/..'), false);
        });

        test('non-WorkspaceFolder scope', () => {
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.other.noScope, '/Users/erijiz/TestRepos/js1'), false);
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.other.global, '/Users/erijiz/TestRepos/js1'), true);
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.other.workspace, '/Users/erijiz/TestRepos/js1'), true);
            assert.equal(taskUtils.isTaskInScopeOfPath(tasks.other.actualGlobal, '/Users/erijiz/TestRepos/js1'), true);
        });
    });

    suite('isTaskScopeEqual', () => {
        test('true', () => {
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.js.install), true);
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.js.start), true);
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.js.prune), true);
        });

        test('false', () => {
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.ts.install), false);
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.ts.start), false);
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.cs.build), false);
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.other.global), false);
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.other.workspace), false);
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.other.actualGlobal), false);
            assert.equal(taskUtils.isTaskScopeEqual(tasks.js.install, tasks.other.noScope), false);
        });
    });

    suite('isTaskEqual', () => {
        test('true, shell task', () => {
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.js.install), true);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, { ...tasks.js.install }), true);
        });

        test('true, func task', () => {
            assert.equal(taskUtils.isTaskEqual(tasks.js.start, tasks.js.start), true);
            assert.equal(taskUtils.isTaskEqual(tasks.js.start, { ...tasks.js.start }), true);
        });

        test('false', () => {
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.js.start), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.js.prune), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.ts.install), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.ts.start), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.cs.build), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.other.global), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.other.workspace), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.other.actualGlobal), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.install, tasks.other.noScope), false);
            assert.equal(taskUtils.isTaskEqual(tasks.js.start, tasks.other.nonFuncType), false);
        });
    });

    suite('findTask', () => {
        function testFindTask(taskPath: string, taskName: string, expectedTask: Task | undefined): void {
            assert.equal(taskUtils.findTask(taskPath, taskName, allTasks), expectedTask);
            // test against reversed list just to make sure it didn't get lucky based on the order it searched
            assert.equal(taskUtils.findTask(taskPath, taskName, allTasksReversed), expectedTask);
        }

        test('preDeployTask', () => {
            testFindTask('/Users/erijiz/TestRepos/js1', 'npm prune', tasks.js.prune);
            testFindTask('/Users/erijiz/TestRepos/ts1', 'npm prune', tasks.ts.prune);
            testFindTask('/Users/erijiz/TestRepos/cs1', 'publish', tasks.cs.publish);
        });

        test('postDeployTask', () => {
            testFindTask('/Users/erijiz/TestRepos/js1', 'npm install', tasks.js.install);
            testFindTask('/Users/erijiz/TestRepos/ts1', 'npm install', tasks.ts.install);
        });

        test('preLaunchTask', () => {
            testFindTask('/Users/erijiz/TestRepos/js1', 'func: host start', tasks.js.start);
            testFindTask('/Users/erijiz/TestRepos/ts1', 'func: host start', tasks.ts.start);
            testFindTask('/Users/erijiz/TestRepos/cs1', 'func: host start', tasks.cs.start);
            testFindTask('/Users/erijiz/TestRepos/py1', 'func: host start', tasks.py.start);
        });

        test('other', () => {
            testFindTask('/Users/erijiz/TestRepos/js1', 'nPm PrUnE', tasks.js.prune);
            testFindTask('/Users/erijiz/TestRepos/js1', 'install', tasks.other.npmType);
            testFindTask('/Users/erijiz/TestRepos/js1', 'npm: install', tasks.other.npmType);
            testFindTask('/Users/erijiz/TestRepos/js1', 'notfunc: host start', tasks.other.nonFuncType);
            testFindTask('/Users/erijiz/TestRepos/js1', 'tsc: build - tsconfig.json', tasks.other.tscBuild);
            testFindTask('/Users/erijiz/TestRepos/js1', 'build - tsconfig.json', tasks.other.tscBuild);
            testFindTask('/Users/erijiz/TestRepos/js1', 'nope', undefined);
        });
    });
});

namespace tasks {
    export namespace js {
        export const install = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,npm install,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/js1",
                    scheme: "file"
                },
                name: "js1"
            },
            name: "npm install",
            source: "Workspace"
        };

        export const start = <Task><unknown>{
            definition: {
                type: "func",
                command: "host start"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/js1",
                    scheme: "file"
                },
                name: "js1"
            },
            name: "host start",
            source: "Workspace"
        };

        export const prune = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,npm prune --production,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/js1",
                    scheme: "file"
                },
                name: "js1"
            },
            name: "npm prune",
            source: "Workspace"
        };
    }

    export namespace ts {
        export const install = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,npm install,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/ts1",
                    scheme: "file"
                },
                name: "ts1"
            },
            name: "npm install",
            source: "Workspace"
        };

        export const build = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,npm run build,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/ts1",
                    scheme: "file"
                },
                name: "ts1"
            },
            name: "npm build",
            source: "Workspace"
        };

        export const start = <Task><unknown>{
            definition: {
                type: "func",
                command: "host start"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/ts1",
                    scheme: "file"
                },
                name: "ts1"
            },
            name: "host start",
            source: "Workspace"
        };

        export const prune = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,npm prune --production,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/ts1",
                    scheme: "file"
                },
                name: "ts1"
            },
            name: "npm prune",
            source: "Workspace"
        };
    }

    export namespace cs {
        export const clean = <Task><unknown>{
            definition: {
                type: "process",
                id: "process,dotnet,clean,/property:GenerateFullPaths=true,/consoleloggerparameters:NoSummary,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/cs1",
                    scheme: "file"
                },
                name: "cs1"
            },
            name: "clean",
            source: "Workspace"
        };

        export const build = <Task><unknown>{
            definition: {
                type: "process",
                id: "process,dotnet,build,/property:GenerateFullPaths=true,/consoleloggerparameters:NoSummary,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/cs1",
                    scheme: "file"
                },
                name: "cs1"
            },
            name: "build",
            source: "Workspace"
        };

        export const start = <Task><unknown>{
            definition: {
                type: "func",
                command: "host start"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/cs1",
                    scheme: "file"
                },
                name: "cs1"
            },
            name: "host start",
            source: "Workspace"
        };

        export const cleanRelease = <Task><unknown>{
            definition: {
                type: "process",
                id: "process,dotnet,clean,--configuration,Release,/property:GenerateFullPaths=true,/consoleloggerparameters:NoSummary,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/cs1",
                    scheme: "file"
                },
                name: "cs1"
            },
            name: "clean release",
            source: "Workspace"
        };

        export const publish = <Task><unknown>{
            definition: {
                type: "process",
                id: "process,dotnet,publish,--configuration,Release,/property:GenerateFullPaths=true,/consoleloggerparameters:NoSummary,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/cs1",
                    scheme: "file"
                },
                name: "cs1"
            },
            name: "publish",
            source: "Workspace"
        };
    }

    export namespace py {
        export const install = <Task><unknown>{
            definition: {
                type: "shell",
                // tslint:disable-next-line: no-invalid-template-strings
                id: "shell,${config:azureFunctions.pythonVenv}/bin/python -m pip install -r requirements.txt,"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/py1",
                    scheme: "file"
                },
                name: "py1"
            },
            name: "pipInstall",
            source: "Workspace"
        };

        export const start = <Task><unknown>{
            definition: {
                type: "func",
                command: "host start"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/py1",
                    scheme: "file"
                },
                name: "py1"
            },
            name: "host start",
            source: "Workspace"
        };
    }

    export namespace other {
        export const global = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,echo 'hello from global',"
            },
            // NOTE: Global tasks "work", but aren't officially supported per the latest "vscode.d.ts". That could be why the scope here is equivalent to TaskScope.Workspace
            scope: 2,
            name: "echo",
            source: "Workspace"
        };

        export const workspace = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,echo 'hello from workspace',"
            },
            scope: 2,
            name: "echo",
            source: "Workspace"
        };

        export const actualGlobal = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,echo 'hello from global',"
            },
            // Don't think this is possible at the moment, but will test against it anyways
            scope: 1, // TaskScope.Global
            name: "echo",
            source: "Workspace"
        };

        export const noScope = <Task><unknown>{
            definition: {
                type: "shell",
                id: "shell,echo 'hello from nowhere',"
            },
            // Don't think this is possible at the moment, but will test against it anyways
            scope: undefined,
            name: "echo",
            source: "Workspace"
        };

        export const npmType = <Task><unknown>{
            definition: {
                type: "npm",
                script: "install"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/js1",
                    scheme: "file"
                },
                name: "js1"
            },
            name: "install",
            source: "npm"
        };

        export const nonFuncType = <Task><unknown>{
            definition: {
                type: "notfunc"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/js1",
                    scheme: "file"
                },
                name: "js1"
            },
            name: "host start",
            source: "Workspace"
        };

        // Using this because the `source` is different than the `definition.type`
        export const tscBuild = <Task><unknown>{
            definition: {
                type: "typescript",
                tsconfig: "tsconfig.json"
            },
            scope: {
                uri: {
                    fsPath: "/Users/erijiz/TestRepos/js1",
                    scheme: "file"
                },
                name: "js1",
                index: 0
            },
            name: "build - tsconfig.json",
            source: "tsc"
        };
    }
}

const allTasks: Task[] = (<Task[]>[]).concat(...Object.values(tasks).map(v => Object.values(v)));
const allTasksReversed: Task[] = allTasks.reverse();
