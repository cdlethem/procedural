export declare const pathsASettings: {
    "rounded-panels": {
        defaults: {
            iterations: number;
            panels: number;
            weight: number;
        };
        structuralEdit: {
            panels: number;
        };
    };
    "flowing-brushes": {
        defaults: {
            iterations: number;
            rows: number;
            weight: number;
        };
        structuralEdit: {
            rows: number;
        };
    };
    "contour-abstraction": {
        defaults: {
            tolerance: number;
            layers: number;
            weight: number;
        };
        structuralEdit: {
            tolerance: number;
        };
    };
    "gesture-skeletons": {
        defaults: {
            tolerance: number;
            gestures: number;
            weight: number;
        };
        structuralEdit: {
            gestures: number;
        };
    };
    "road-margins": {
        defaults: {
            distance: number;
            routes: number;
            weight: number;
        };
        structuralEdit: {
            distance: number;
        };
    };
    "nested-contour-strokes": {
        defaults: {
            distance: number;
            rings: number;
            weight: number;
        };
        structuralEdit: {
            rings: number;
        };
    };
    "scatter-envelopes": {
        defaults: {
            count: number;
            weight: number;
            inset: number;
        };
        structuralEdit: {
            count: number;
        };
    };
    "terraced-islands": {
        defaults: {
            count: number;
            terraces: number;
            weight: number;
        };
        structuralEdit: {
            terraces: number;
        };
    };
    "faceted-silhouettes": {
        defaults: {
            scale: number;
            weight: number;
            grain: number;
        };
        structuralEdit: {
            grain: number;
        };
    };
    "concave-grain": {
        defaults: {
            scale: number;
            weight: number;
            grain: number;
        };
        structuralEdit: {
            grain: number;
        };
    };
};
/** Rounded quilt panels made from repeated Chaikin corner cuts. */
export declare function drawRoundedPanels(p: any, layer: any): void;
/** Layered calligraphic ribbons refined from deliberately angular routes. */
export declare function drawFlowingBrushes(p: any, layer: any): void;
/** A terrain-like record of the same path at increasingly coarse tolerances. */
export declare function drawContourAbstraction(p: any, layer: any): void;
/** Sparse gesture routes whose retained joints become visible skeletons. */
export declare function drawGestureSkeletons(p: any, layer: any): void;
/** Parallel margins reveal the joins and bevels of winding road centerlines. */
export declare function drawRoadMargins(p: any, layer: any): void;
/** Nested offset contours turn one closed boundary into a stack of ink rings. */
export declare function drawNestedContourStrokes(p: any, layer: any): void;
/** Convex envelopes make a loose scatter of sites read as bold perimeter marks. */
export declare function drawScatterEnvelopes(p: any, layer: any): void;
/** A family of hulls at shrinking radii gives islands stepped terrace edges. */
export declare function drawTerracedIslands(p: any, layer: any): void;
/** A convex silhouette split into visible deterministic triangular planes. */
export declare function drawFacetedSilhouettes(p: any, layer: any): void;
/** A concave grain-filled silhouette demonstrates deterministic ear ordering. */
export declare function drawConcaveGrain(p: any, layer: any): void;
