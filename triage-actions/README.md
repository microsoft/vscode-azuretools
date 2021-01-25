# Azure Tools for VS Code's Issue Triage GitHub Actions

This is a pared down version of [VS Code's issue triage GitHub Actions](https://github.com/microsoft/vscode-github-triage-actions) with customizations specific to Azure Tools.

In `./api`, we have a wrapper around the Octokit instance that can be helpful for developing (and testing!) your own Actions.

*Note:* All Actions must be compiled/packaged into a single output file for deployment. We use [ncc](https://github.com/zeit/ncc) and [husky](https://github.com/typicode/husky) to do this on-commit. Thus committing can take quite a while. If you're making a simple change to non-code files or tests, this can be skipped with the `--no-verify` `git commit` flag.

### Code Layout

The `api` directory contains `api.ts`, which provides an interface for interacting with github issues. This is implemented both by `octokit.ts` and `testbed.ts`. Octokit will talk to github, testbed mimics GitHub locally, to help with writing unit tests.

The `utils` directory contains various commands to help with interacting with GitHub/other services, which do not have a corresponding mocked version. Thus when using these in code that will be unit tested, it is a good idea to manually mock the calls, using `nock` or similar.

The rest of the directories contain three files:
- `index.ts`: This file is the entry point for actions. It should be the only file in the directory to use Action-specific code, such as any imports from `@actions/`. In most cases it should simply gather any required config data, create an `octokit` instance (see `api` section above) and invoke the command. By keeping Action specific code seperate from the rest of the logic, it is easy to extend these commands to run via Apps, or even via webhooks to Azure Funtions or similar.
- `Command.ts`: This file contains the core logic for the command. The commands should operate on the Github interface in `api`, so that they may be run against either GitHub proper or the Testbed.
- `Command.test.ts`: This file contains tests for the command. Tests should invoke the command using a `Testbed` instance, and preferably verify the command works by querying through the `Github` interface, though there are some convenience commands implemented directly on `Testbed` for ease of testing.
- `cpi.ts`: This is not present in every directory, but when present allows for running the action via command line, by running `node action/cli.js` with appropriate flags.

## Action Descriptions

### Locker
Lock issues and PRs that have been closed and not updated for some time.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  daysSinceClose:
    description: Days to wait since closing before locking the item
    required: true
  daysSinceUpdate:
    description: days to wait since the last interaction before locking the item
    required: true
  ignoredLabel:
    description: items with this label will not be automatically locked
  ignoreLabelUntil:
    description: items with this label will not be automatically locked, until they also have the until label
  labelUntil:
    description: items with this will not automatically locked, even if they have the ignoreLabelUntil label
```

### Needs More Info Closer
Close issues that are marked a `needs more info` label and were last interacted with by a contributor or bot, after some time has passed.

Can also ping the assignee if the last comment was by someonne other than a team member or bot.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  label:
    description: Label signifying an issue that needs more info
    required: true
  additionalTeam:
    description: Pipe-separated list of users to treat as team for purposes of closing `needs more info` issues
  closeDays:
    description: Days to wait before closing the issue
    required: true
  closeComment:
    description: Comment to add upon closing the issue
  pingDays:
    description: Days to wait before pinging the assignee
    required: true
  pingComment:
    description: Comment to add whenn pinging assignee. ${assignee} and ${author} are replaced.
```

### Stale Closer
Close issues in a backlog candidate milestone that have become stale.

```yml
inputs:
  token:
    description: GitHub token with issue, comment, and label read/write permissions
    default: ${{ github.token }}
  closeDays:
    description: Days to wait before closing the issue
    required: true
  closeComment:
    description: Comment to add upon closing the issue
    required: true
  warnDays:
    description: Number of days before closing the issue to warn about it's impending closure
    required: true
  warnComment:
    description: Comment when an issue is nearing automatic closure
    required: true
  upvotesRequired:
    description: Number of upvotes required to prevent automatic closure
    required: true
  numCommentsOverride:
    description: Number of comments required to prevent automatic closure
    required: true
  candidateMilestone:
    description: Milestone with candidate issues that will be checked for automatic closure
    required: true
  labelsToExclude:
    description: Comma-separated list of labels to exclude from automatic closure
  readonly:
    description: If set, perform a dry-run
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
