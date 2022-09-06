import { AzExtTreeItem, IActionContext } from "./index";

/**
 * Interface describing an object that wraps another object.
 *
 * The host extension will wrap all tree nodes provided by the client
 * extensions. When commands are executed, the wrapper objects are
 * sent directly to the client extension, which will need to unwrap
 * them. The `registerCommandWithTreeNodeUnboxing` method below, used
 * in place of `registerCommand`, will intelligently do this
 * unboxing automatically (i.e., will not unbox if the arguments
 * aren't boxes)
 */
export interface Box {
    unwrap<T>(): T;
}

/**
 * Describes command callbacks for tree node context menu commands
 */
export type TreeNodeCommandCallback<T> = (context: IActionContext, node?: T, nodes?: T[], ...args: any[]) => any;

/**
 * Used to register VSCode tree node context menu commands that are in the host extension's tree. It wraps your callback with consistent error and telemetry handling
 * Use debounce property if you need a delay between clicks for this particular command
 * A telemetry event is automatically sent whenever a command is executed. The telemetry event ID will default to the same as the
 *   commandId passed in, but can be overridden per command with telemetryId
 * The telemetry event for this command will be named telemetryId if specified, otherwise it defaults to the commandId
 * NOTE: If the environment variable `DEBUGTELEMETRY` is set to a non-empty, non-zero value, then telemetry will not be sent. If the value is 'verbose' or 'v', telemetry will be displayed in the console window.
 */
export declare function registerCommandWithTreeNodeUnboxing<T>(commandId: string, callback: TreeNodeCommandCallback<T>, debounce?: number, telemetryId?: string): void;

/**
 * Describes filtering based on context value. Items that pass the filter will
 * match at least one of the `include` filters, but none of the `exclude` filters.
 */
export interface ContextValueFilter {
    /**
     * This filter will include items that match *any* of the values in the array.
     * When a string is used, exact value comparison is done.
     */
    include: string | RegExp | (string | RegExp)[];

    /**
     * This filter will exclude items that match *any* of the values in the array.
     * When a string is used, exact value comparison is done.
     */
    exclude?: string | RegExp | (string | RegExp)[];
}

export interface ContextValueFilterableTreeNodeV2 {
    readonly quickPickOptions: {
        readonly contextValues: Array<string>;
        readonly isLeaf: boolean;
    }
}

export type ContextValueFilterableTreeNode = ContextValueFilterableTreeNodeV2 | AzExtTreeItem;

export type ResourceGroupsItem = ContextValueFilterableTreeNode;
