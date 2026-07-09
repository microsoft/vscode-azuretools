#!/usr/bin/env sh
# --------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license information.
# --------------------------------------------------------------------------------------------

# Configure pnpm's global registry to the corporate npm proxy feed.
# Uses pnpm's own global config (not ~/.npmrc) to avoid breaking Azure Artifacts
# credential provider authentication.
set -e

pnpm config set registry 'https://packagefeedproxy.microsoft.io/npm/' --global
