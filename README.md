# VSCode Azure SDK for Node.js

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This project provides Node.js packages that make it easy to consume and manage Azure Services in Visual Studio Code.

## Modules

* [Azure Kudu](kudu/)
* [Azure App Service](appservice/)
* [Azure UI](ui/)
* [Azure Dev](dev/)

## Developing locally

In order to quickly develop and debug these packages locally, follow these instructions:
1. Navigate to the package you are developing and run `npm install`, `npm run build`, and `npm link`
1. Navigate to the project that references the package you're developing and run `npm link <name of package>`

Example:
```
    cd ~/repos/vscode-azuretools/ui
    npm install
    npm run build
    npm link
    cd ~/repos/vscode-azurestorage
    npm link vscode-azureextensionui
```

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