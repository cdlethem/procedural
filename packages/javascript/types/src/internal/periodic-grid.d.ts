/** Shared private arithmetic for the reviewed periodic scalar/MAC contracts. */
import { get, number, computed, fail } from './systems-a-utils.js';
export { computed, get, number, fail };
export declare function dimensions(input: any): {
    columns: any;
    rows: any;
    size: number;
};
export declare function field(value: any, size: any): any;
export declare function wrap(value: any, extent: any): number;
export declare function sample(values: any, columns: any, rows: any, x: any, y: any): any;
export declare function neighbors(index: any, columns: any, rows: any): number[];
export declare function divergence(u: any, v: any, columns: any, rows: any): any[];
