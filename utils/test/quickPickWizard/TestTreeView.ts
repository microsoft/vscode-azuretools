import * as vscode from 'vscode';

export type TestTreeNode = vscode.TreeItem & {
    element?: any;
    children?: TestTreeNode[];
}

export function TestTreeDataProvider(tree: TestTreeNode[]): vscode.TreeDataProvider<TestTreeNode> {
    return {
        getChildren: (element) => {
            if (!element) {
                return tree;
            }
            return element?.children;
        },
        getTreeItem: (element): vscode.TreeItem => {
            return {
                ...element,
                collapsibleState: element.children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
            };
        }
    };
}
