export declare class P5FeedbackSurfaceError extends Error {
    code: any;
    constructor(code: any, message: any);
}
export declare function createP5FeedbackSurface(p: any, options: any): {
    readonly frame: any;
    readonly tick: number;
    step(data: any): /*elided*/ any;
    draw(x: any, y: any, width: any, height: any): /*elided*/ any;
    reset(): /*elided*/ any;
    resize(width: any, height: any): /*elided*/ any;
    dispose(): void;
};
