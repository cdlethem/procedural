/** Error with one of the stable path.occupied-lattice-paths-2d contract codes. */
export declare class LatticeError extends Error {
    code: any;
    constructor(code: any);
}
declare class LatticePaths {
    #private;
    constructor(x: any, y: any, offsets: any, reasons: any, randomState: any);
    get pathCount(): any;
    pathLengthAt(path: any): number;
    cellAt(path: any, cell: any): any[];
    cellInto(path: any, cell: any, output: any, offset?: number): any;
    completionReasonAt(path: any): any;
    randomState(): any;
    toValues(): {
        paths: any[][][];
        completionReasons: any;
        randomState: any;
    };
}
/**
 * Generate ordered retained cardinal cell paths whose cells are claimed by one
 * call-local occupancy set. Implements path.occupied-lattice-paths-2d 0.1.0
 * independently of source code. Motivating sketch: survey/out/2019/generativos/tata;
 * no artistic dimensions/starts/step range is established, see the catalog contract
 * for evidence.
 */
export declare function occupiedLatticePaths2D(config: any): LatticePaths;
export {};
