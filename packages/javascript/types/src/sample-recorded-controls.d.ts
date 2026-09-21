/** Stable errors for signal.sample-recorded-controls 0.1.0. */
export declare class SampleRecordedControlsError extends Error {
    code: any;
    constructor(code: any);
}
/**
 * Samples explicit scalar channels at a caller-supplied time. All carriers and all
 * source values are validated before the exact T*C+M work preflight. The result is
 * detached and stateless; feature extraction, fonts and media remain host work.
 * Motivated by the recorded-control task in Davis's NikeLab 21 Mercer work;
 * see design/capabilities/recorded-controls-and-type.md for evidence limits.
 */
export declare function sampleRecordedControls(input: any): {
    values: any[];
};
