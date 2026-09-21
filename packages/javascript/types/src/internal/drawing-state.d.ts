import { DrawingError } from "./drawing.js";
/** A fresh-raster lifecycle error with an optional absolute command index. */
export declare class FrameError extends DrawingError {
    commandIndex: any;
    constructor(code: any, commandIndex?: null);
}
/**
 * Pure internal lifecycle state for a fresh-raster frame.
 * It owns no renderer, surface lease, callback, or producer command buffer.
 */
export declare class FrameState {
    #private;
    get state(): string;
    get count(): number;
    /** Validate an environment and issue an immutable begin plan. */
    prepareBegin(environment: any): any;
    /** Resolve a matching begin plan after adapter setup succeeds. */
    activate(plan: any): void;
    /** Resolve a matching begin plan after a phase-specific adapter failure. */
    failBegin(plan: any, code: any): void;
    /**
     * Fully validate and normalize one bounded batch before any adapter drawing.
     * Slots retain input offsets, including no-op commands, until synchronous resolution.
     */
    prepareBatch(commands: any): any;
    /** Commit a matching batch only after the adapter completes every slot. */
    commitBatch(plan: any): void;
    /** Abort a matching batch after a native failure at an original input offset. */
    failBatch(plan: any, sourceOffset: any): void;
    /** Issue an identity-bound end token for adapter finalization. */
    prepareEnd(): any;
    /** Resolve a matching end token and mark the frame completed. */
    completeEnd(token: any): void;
    /** Resolve a matching end token after native finalization fails. */
    failEnd(token: any): void;
    /** Idempotently abort an unfinished frame; completed frames remain immutable. */
    abort(): void;
    /** Test-only exact-count hook; this internal module is never package-exported. */
    static forTestActive(environment: any, count: any): FrameState;
}
