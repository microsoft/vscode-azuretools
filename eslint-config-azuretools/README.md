# Azure Tools for VS Code's ESLint Config

This package provides extensible ESLint configs used by the Azure Tools for VS Code Team.

* `eslint-config-azuretools` (for production code)
* `eslint-config-azuretools/test` (for test code)

## Usage

1. Install this package and its peer dependencies. Peer dependencies can be listed with the following command:

    ```bash
    npm info eslint-config-azuretools peerDependencies
    ```

2. Depending on which config you want to use, add the following to your `.eslintrc`:

    ```json
    "extends": "azuretools"
    ```
    or
    ```json
    "extends": [ "azuretools", "azuretools/test" ]
    ```

## License
[MIT](LICENSE.md)
