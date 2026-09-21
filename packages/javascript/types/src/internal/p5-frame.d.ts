/**
 * Internal p5 P2D/Canvas2D adapter for drawing.fresh-raster-2d v0.1.0.
 * It owns a new graphics buffer while active and transfers it only after end().
 * No host object enters the portable FrameState or package public API.
 */
export declare class P5Frame {
    #private;
    /**
     * @param {object} p A p5 instance.
     * @param {Function|null} testFactory Internal fault-injection seam. Production
     * always calls p.createGraphics(width, height, p.P2D).
     * @param {Function} testContextVerifier Internal seam for non-browser unit tests.
     */
    constructor(p: object, testFactory?: Function | null, testContextVerifier?: Function);
    get state(): string;
    get count(): number;
    /** Acquire and initialize a fresh owned P2D graphics buffer. */
    begin(environment: any): void;
    /** Normalize a complete batch, then draw its emitting slots in encounter order. */
    batch(commands: any): void;
    /** Complete the frame and transfer its graphics buffer to the caller. */
    end(): null;
    /** Abort an unfinished frame and release its owned buffer exactly once. */
    abort(): void;
    /**
     * Release a completed p5.Graphics buffer after integration display/save.
     * It is idempotent and clears the backing canvas before p5 removes its element.
     */
    static releaseCompleted(graphics: any): void;
}
