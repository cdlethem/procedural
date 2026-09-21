export declare const FONT_PATH = "/examples/glyph-marks/assets/GlyphMarks.ttf";
export declare const FONT_SHA256 = "b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c";
export declare function synthesizedPCM(): any[];
export declare function synthesizedFeatures(): {
    times: number[];
    channels: string[];
    samples: number[][];
};
export declare function nonAudioFeatures(): {
    times: number[];
    channels: string[];
    samples: number[][];
};
export declare function controlsAt(features: any, time: any, radiusScale?: number): {
    values: any[];
};
export declare function createWordEchoStudy(): void;
