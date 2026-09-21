/** Example composition motivated by 2018/Generativos/pelines, not a public operation.
 * Retain field attributes so palette and mark edits never resample the field.
 * These constants are composition choices, not recommended parameter ranges.
 */
export declare function createMarkField(seed?: number, columns?: number, rows?: number, pitch?: number): {};
/** Stream plain drawing values; the adapter owns validation and native execution. */
export declare function markCommands(marks: any, maxLength: any, colors: any, bars?: boolean): Generator<{
    kind: string;
    vertices: any[][];
    rgb: any;
    opacity8: number;
    from?: undefined;
    to?: undefined;
    width?: undefined;
    cap?: undefined;
} | {
    vertices?: undefined;
    kind: string;
    from: number[];
    to: any[];
    rgb: any;
    opacity8: number;
    width: number;
    cap: string;
}, void, unknown>;
