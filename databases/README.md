# VSCode Azure SDK for Node.js - Databases Tools (Preview)

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This package provides common Azure Databases elements for VS Code extensions.

This package provides functionality specifically designed for use in VS Code, currently supported:
* connectDB: Guides the user through creation of Databases connection in Azure Appservice extension
* create server/database account: Supports the creation of Azure Database resources in Azure Databases extension

> NOTE: This package throws a `UserCancelledError` if the user cancels an operation. This error should be handled appropriately by your extension.

## License
[MIT](LICENSE.md)
