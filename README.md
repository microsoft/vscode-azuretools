# VSCode Azure SDK for Node.js

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This project provides Node.js packages that make it easy to consume and manage Azure Services in Visual Studio Code.

## Modules

* [Azure Kudu](kudu/)
* [Azure App Service](appservice/)
* [Azure Extension UI++ utilities (no Azure dependencies)](utils/)
* [Azure Extension UI++ utilities (Azure dependencies)](azure/)
* [Azure Dev](dev/)

## Developing locally

In order to develop and debug these packages locally, follow these instructions:
1. Navigate to the package you are developing
1. Run `npm install`
1. Run `npm pack` and note down the name of the "tgz" file created
1. Navigate to the project that references the package you're developing and run `npm install <path to tgz>`

Example:
```
    cd ~/repos/vscode-azuretools/ui
    npm install
    npm pack
    cd ~/repos/vscode-azurestorage
    npm install ../vscode-azuretools/ui/vscode-azureextensionui-0.44.2.tgz
```

> NOTE: You may also try [`npm link`](https://docs.npmjs.com/cli/v7/commands/npm-link), but we've had issues with this method including breakpoints not being hit and dependencies (e.g. "fs-extra") being removed in the package's repo

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## License
[MIT](LICENSE.md)
