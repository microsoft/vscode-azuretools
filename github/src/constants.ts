import type { IAzureQuickPickItem } from "@microsoft/vscode-azext-utils";
import { l10n } from "vscode";

export const loadMoreQp: IAzureQuickPickItem = { label: l10n.t('$(sync) Load More'), data: undefined, suppressPersistence: true };
