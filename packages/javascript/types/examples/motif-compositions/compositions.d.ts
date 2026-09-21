export declare const CANVAS = 720;
/** Copy a shipped palette so a study can safely edit its local colors. */
export declare function palette(id: any): number[];
export declare function rgb(value: any): number[];
/** Retained packing positions for an original botanical ornament composition. */
export declare function botanicalLayout(dense?: boolean): Readonly<{
    kind: "botanical";
    dense: boolean;
    rows: readonly (readonly any[])[];
}>;
/** A regular-grid record leaves the asymmetric panel's local marks replaceable. */
export declare function panelLayout(tight?: boolean): Readonly<{
    kind: "panel";
    tight: boolean;
    columns: 6 | 8;
    rowsCount: 8 | 10;
    rows: readonly (readonly number[])[];
}>;
/** Resampled, retained orbital paths for brush substitutions. */
export declare function orbitalLayout(more?: boolean): Readonly<{
    kind: "orbital";
    more: boolean;
    paths: readonly Readonly<{
        points: readonly any[];
        colorIndex: number;
        width: number;
    }>[];
}>;
