# VSCode Azure SDK for Node.js

This project provides Node.js packages that make it easy to consume and manage Azure Services in Visual Studio Code.

## Modules

* [Azure App Service](appservice/)
* [Azure App Settings](appsettings/)
* [Azure Authentication and Subscription Provider](auth/)
* [Azure Extension UI++ utilities (no Azure dependencies)](utils/)
* [Azure Extension UI++ utilities (Azure dependencies)](azure/)
* [Azure Extension Engineering](eng/)

## Developing locally

In order to develop and debug these packages locally, follow these instructions:
1. Navigate to the package you are developing
1. Run `npm install`
1. Run `npm run build && npm run package` and note down the name of the "tgz" file created
1. Navigate to the project that references the package you're developing and run `npm install <path to tgz>`

Example:
```
    cd ~/repos/vscode-azuretools/utils
    npm install
    npm run build && npm run package
    cd ~/repos/vscode-azurestorage
    npm install ../vscode-azuretools/utils/microsoft-vscode-azext-utils-4.0.0.tgz
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

### Pull requests and reviews

Keep PR descriptions brief: start with `Fixes #<issue>` (or `Fixes owner/repo#number` for a cross-repository issue), give a human-readable 1-2 line reason for the change, then include labeled **Before** and **After** screenshots. Reproduce the bug without the candidate changes first, then exercise the same scenario with them to demonstrate the fix. For new features, show the baseline behavior and the feature working.

Reviews must independently exercise that same scenario without the candidate changes first and capture a baseline screenshot, then repeat with the candidate changes and capture a screenshot demonstrating the feature or fix. Check relevant regression behavior as well. Keep each finding to one human-readable line; for a reported bug, attach a real screenshot demonstrating it.

Use only real screenshots and redact secrets and sensitive data before sharing. For docs-only or nonvisual changes, explicitly state that screenshots are not applicable and provide relevant validation commands and results instead, where applicable. If execution or screenshot capture is blocked, report the blocker and what remains unverified rather than claiming success. Screenshots do not replace relevant tests or existing technical requirements.

## License
[MIT](LICENSE.md)
