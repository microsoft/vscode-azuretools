# VSCode Azure SDK for Node.js - App Service Tools (Preview)

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This package provides common Azure App Service elements for VS Code extensions.

All functionality for this package is built around the `SiteClient`, a wrapper of a `WebSiteManagementClient` for use with a specific Site. It reduces the number of arguments needed for every call and automatically ensures the 'slot' method is called when appropriate. Support for all methods on the `WebSiteManagementClient` are being added on an as-needed basis.

On top of that, this package provides functionality specifically designed for use in VS Code, including but not limited to:
* createFunctionApp/createWebApp: Guides the user through creation of a Function App or Web App.
* deploy: Automatically detects a site's deployment source and deploys based on that.
* startStreamingLogs: Creates a stream of the Site's logs to the outputChannel in VS Code.

> NOTE: This package throws a `UserCancelledError` if the user cancels an operation. This error should be handled appropriately by your extension.

## License
[MIT](LICENSE.md)
