export declare class SvgPlotPlan01Error extends Error {
    code: any;
    constructor(code: any);
}
/** Emit a deliberately small SVG path document whose coordinates are already millimetres. */
export declare function svgPlotPlan01(configuration: any): {
    svg: string;
};
