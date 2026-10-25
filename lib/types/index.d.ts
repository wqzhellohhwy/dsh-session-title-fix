export declare const name = "@dsh-external/dsh-session-title-fix";
export declare const inject: string[];
type AppContext = {
    get?: (name: string) => unknown;
    inject?: (deps: string[], run: (child: AppContext) => void) => void;
    effect?: (run: () => (() => void) | void) => void;
};
export declare function apply(ctx: AppContext): void;
export {};
