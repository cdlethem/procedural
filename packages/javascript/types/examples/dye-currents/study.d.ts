export declare const SIZE = 96, CELLS: number;
export declare function initialFluid(texture?: boolean): {
    tick: number;
    u: number[];
    v: number[];
    dyes: never[][];
    pressure: any[];
    residualBefore: number;
    residualAfter: number;
};
export declare function stepFluid(old: any, { injection, viscosity, projection }?: {
    injection?: number | undefined;
    projection?: boolean | undefined;
    viscosity?: number | undefined;
}): {
    tick: any;
    u: any[];
    v: any[];
    dyes: any;
    pressure: any[];
    residualBefore: number;
    residualAfter: number;
};
