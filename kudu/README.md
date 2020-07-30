# VSCode Azure SDK for Node.js - KuduClient

[![Build Status](https://dev.azure.com/ms-azuretools/AzCode/_apis/build/status/vscode-azuretools)](https://dev.azure.com/ms-azuretools/AzCode/_build/latest?definitionId=17)

This package provides an automatically generated typescript client for [Kudu](https://github.com/projectkudu/kudu).

## Concepts

* [Swagger](https://swagger.io/): A tool for describing and debugging REST APIs. For ASP.NET projects, you add swagger with this single [nuget package](https://www.nuget.org/packages/Swashbuckle/).
* [AutoRest](https://github.com/Azure/autorest): A tool for creating client libraries for REST APIs. In this repo, we give it a [swagger.json](swagger.json) file and it creates a typescript client.

## Development

If changes to this package are necessary, manually edit "swagger.json". This file used to be generated off a [fork of kudu](https://github.com/EricJizbaMSFT/kudu) that enabled swagger, but the fork has fallen out of sync with the [original](https://github.com/projectkudu/kudu) and it's just not worth the effort to keep them in sync.

Then, install "autorest" and run the following command to re-generate the source code of this package:
```
autorest autorestconfig.json
```

## License
[MIT](LICENSE.md)