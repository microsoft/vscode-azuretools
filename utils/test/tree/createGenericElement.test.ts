/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import assert = require("assert");
import { createGenericElement } from "../../src/index";

suite('createGenericElement', () => {
    test('command.arguments is set to item if not specified', async () => {
        const item = createGenericElement({
            label: 'genericItem',
            contextValue: 'genericItem',
            commandId: 'commandId'
        });

        const treeItem = await item.getTreeItem();

        assert.strictEqual(treeItem.command?.arguments?.[0], item);
    });
});
