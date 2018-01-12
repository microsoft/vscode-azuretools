# VSCode Azure SDK for Node.js - KuduClient

This package provides an automatically generated typescript client for [Kudu](https://github.com/projectkudu/kudu).

## Concepts

* [Swagger](https://swagger.io/): A tool for describing and debugging REST APIs. For ASP.NET projects, you add swagger with this single [nuget package](https://www.nuget.org/packages/Swashbuckle/).
* [AutoRest](https://github.com/Azure/autorest): A tool for creating client libraries for REST APIs. In this repo, we give it a [swagger.json](swagger.json) file and it creates a typescript client.

## Development

This package will not work in many cases because the Kudu repo is missing important metadata. It is slowly improving on an as-needed basis (largely driven by a few App Service extensions in VS Code). To make changes to the package, follow these steps:
1. Clone the [forked version of Kudu](https://github.com/EricJizbaMSFT/kudu/tree/swagger) that has Swagger enabled
1. Make your changes to the [swagger config file](https://github.com/EricJizbaMSFT/kudu/blob/swagger/Kudu.Services.Web/App_Start/SwaggerConfig.cs) or take a look at the [common fixes](#common-fixes) below.
1. Run Kudu and navigate to the swagger endpoint (It will be a url similar to `http://localhost:16167/swagger/docs/v1`, but the port will likely be different)
1. Copy the generated json to the [swagger.json](swagger.json) file in this repo.
1. Run `npm run build` to generate your typescript client library from the updated [swagger.json](swagger.json).

> NOTE: It might be easier to manually edit the 'swagger.json' file when you're debugging this package. However, you should always make the corresponding change in the Kudu repo so that we can continue to automatically generate the [swagger.json](swagger.json) file.

### Common Fixes
1. Most of the generated typescript methods return a generic 'object'. You must add a `ResponseType` in the Kudu repo to actually get helpful types:
    ```c#
    using System.Web.HttpDescription; // <-- This line must be added

    class ExampleController
    {
        [HttpGet]
        [ResponseType(typeof(Person))] // <-- This line must be added
        public async Task<HttpResponseMessage> GetPerson()
        {
            return Request.CreateResponse(HttpStatusCode.OK, new Person('Nathan'));
        }
    }
    ```
1. Autorest assumes all responses are 'JSON' and does not support other types (See [this issue](https://github.com/Azure/autorest/issues/1527)). If a call returns something other than JSON, you must specify a return type of 'void' (`[ResponseType(typeof(void))]`) to avoid a JSON parse error and handle the response yourself.

## License
[MIT](LICENSE.md)