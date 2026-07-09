#!/usr/bin/env sh
# --------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license information.
# --------------------------------------------------------------------------------------------

npm install --global @microsoft/artifacts-npm-credprovider --registry 'https://pkgs.dev.azure.com/artifacts-public/PublicTools/_packaging/AzureArtifacts/npm/registry/'
npm config set '@microsoft:registry' 'https://pkgs.dev.azure.com/devdiv/DevDiv/_packaging/azcode/npm/registry/'
NUGET_CREDENTIALPROVIDER_VSTS_TOKENTYPE=SelfDescribing artifacts-npm-credprovider "$@"
