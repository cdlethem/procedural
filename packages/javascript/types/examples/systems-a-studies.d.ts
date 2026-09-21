export declare const systemsASettings: {
    "stream-ribbons": {
        defaults: {
            steps: number;
            lanes: number;
            weight: number;
        };
        structuralEdit: {
            lanes: number;
        };
    };
    "curved-trajectories": {
        defaults: {
            steps: number;
            paths: number;
            weight: number;
        };
        structuralEdit: {
            steps: number;
        };
    };
    "reaction-spots": {
        defaults: {
            passes: number;
            scale: number;
            weight: number;
        };
        structuralEdit: {
            passes: number;
        };
    };
    "reaction-stripes": {
        defaults: {
            passes: number;
            scale: number;
            weight: number;
        };
        structuralEdit: {
            scale: number;
        };
    };
    "organic-cells": {
        defaults: {
            passes: number;
            cellSize: number;
            weight: number;
        };
        structuralEdit: {
            passes: number;
        };
    };
    "geometric-generations": {
        defaults: {
            passes: number;
            cellSize: number;
            weight: number;
        };
        structuralEdit: {
            cellSize: number;
        };
    };
    "woven-rows": {
        defaults: {
            rule: number;
            rows: number;
            cellSize: number;
        };
        structuralEdit: {
            rule: number;
        };
    };
    "triangle-glyphs": {
        defaults: {
            rule: number;
            rows: number;
            cellSize: number;
        };
        structuralEdit: {
            rows: number;
        };
    };
    "swirling-particles": {
        defaults: {
            count: number;
            steps: number;
            weight: number;
        };
        structuralEdit: {
            count: number;
        };
    };
    "flow-needles": {
        defaults: {
            columns: number;
            scale: number;
            weight: number;
        };
        structuralEdit: {
            columns: number;
        };
    };
};
/** RK4 streamlines make soft parallel ribbons from a visible vector grid. */
export declare function drawStreamRibbons(p: any, l: any): void;
/** Curved trajectories fan through the same explicit rotating velocity samples. */
export declare function drawCurvedTrajectories(p: any, l: any): void;
/** Gray-Scott spots are rendered from an explicit bounded replay of concentration state. */
export declare function drawReactionSpots(p: any, l: any): void;
/** A different seeded Gray-Scott disturbance yields horizontal stripe-like masks. */
export declare function drawReactionStripes(p: any, l: any): void;
/** Organic life colonies use rounded cells after synchronous totalistic replays. */
export declare function drawOrganicCells(p: any, l: any): void;
/** The same rule state becomes a crisp square-grid geometric generation. */
export declare function drawGeometricGenerations(p: any, l: any): void;
/** Elementary rows become alternating woven bands of colored cells. */
export declare function drawWovenRows(p: any, l: any): void;
/** Elementary rows use triangle glyphs to emphasize ordered left/center/right rules. */
export declare function drawTriangleGlyphs(p: any, l: any): void;
/** Curl vectors feed the named RK4 tracer to make circular particle streams. */
export declare function drawSwirlingParticles(p: any, l: any): void;
/** Curl samples render directly as short flow needles, without normalization. */
export declare function drawFlowNeedles(p: any, l: any): void;
