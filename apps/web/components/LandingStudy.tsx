"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SketchCanvas from "./SketchCanvas";
import { createDocument, techniques, validateDocument } from "../lib/studio";
import { defaultPalettes, type DefaultPalette } from "../lib/default-palettes";
import type { Layer, Parameter, StudioDocument } from "../lib/studio-types";
import styles from "./LandingStudy.module.css";

const STUDY_IDS = [
  "agent-trails",
  "cut-branch-marks",
  "cell-mosaic",
  "distance-halos",
  "warp-marks",
  "contact-network",
] as const;
type StudyId = (typeof STUDY_IDS)[number];
type RotationState = "playing" | "paused";
type Direction = "next" | "previous";
type Transition = { direction: Direction; phase: "waiting" | "active" };
type StudyDocuments = Record<StudyId, StudioDocument>;
type NumericParameter = Parameter & {
  type: "number";
  min: number;
  max: number;
  step: number;
};

type Study = {
  id: StudyId;
  title: string;
  parameters: readonly NumericParameter[];
  canReseed: boolean;
  palette: DefaultPalette;
};

const STUDY_PARAMETERS: Record<StudyId, readonly string[]> = {
  "agent-trails": ["ticks", "radius", "avoidance"],
  "cut-branch-marks": ["attempts", "angle", "weight"],
  "cell-mosaic": ["sites", "disorder", "inset"],
  "distance-halos": ["scale", "radius", "weight"],
  "warp-marks": ["strength", "scale", "stripe"],
  "contact-network": ["ticks", "radius", "avoidance"],
};

const STUDY_PALETTE_IDS: Record<StudyId, string> = {
  "agent-trails": "fern-mauve",
  "cut-branch-marks": "ochre-plum",
  "cell-mosaic": "cyan-frost",
  "distance-halos": "lemon-garnet",
  "warp-marks": "rose-citrus",
  "contact-network": "deep-teal",
};

function numericParameter(parameter: Parameter): NumericParameter {
  if (
    parameter.type !== "number" ||
    parameter.min === undefined ||
    parameter.max === undefined ||
    parameter.step === undefined
  ) {
    throw new Error(`Landing study parameter ${parameter.key} must be numeric.`);
  }
  return parameter as NumericParameter;
}

function paletteFor(id: StudyId): DefaultPalette {
  const palette = defaultPalettes.find((item) => item.id === STUDY_PALETTE_IDS[id]);
  if (!palette) throw new Error(`Landing study palette ${STUDY_PALETTE_IDS[id]} is unavailable.`);
  return palette;
}

function paletteNumbers(palette: DefaultPalette): number[] {
  return palette.colors.map((value) => Number.parseInt(value.slice(1), 16));
}

const STUDIES: readonly Study[] = STUDY_IDS.map((id) => {
  const technique = techniques.find((item) => item.id === id);
  if (!technique) throw new Error(`Landing study technique ${id} is unavailable.`);
  const parameters = STUDY_PARAMETERS[id].map((key) => {
    const parameter = technique.parameters.find((item) => item.key === key);
    if (!parameter) throw new Error(`Landing study parameter ${key} is unavailable.`);
    return numericParameter(parameter);
  });
  return {
    id,
    title: technique.title,
    parameters,
    canReseed: id !== "agent-trails" && id !== "contact-network",
    palette: paletteFor(id),
  };
});

const PALETTES = STUDIES.map((study) => ({ ...study.palette, values: paletteNumbers(study.palette) }));

function createStudyDocuments(): StudyDocuments {
  const documents = {} as StudyDocuments;
  for (const study of STUDIES) {
    const document = createDocument(study.id);
    documents[study.id] = validateDocument({
      ...document,
      layers: [{ ...document.layers[0], palette: paletteNumbers(study.palette) }],
    });
  }
  return documents;
}

function nextStudyId(current: StudyId): StudyId {
  return STUDY_IDS[(STUDY_IDS.indexOf(current) + 1) % STUDY_IDS.length];
}

function previousStudyId(current: StudyId): StudyId {
  return STUDY_IDS[(STUDY_IDS.indexOf(current) + STUDY_IDS.length - 1) % STUDY_IDS.length];
}

export function LandingStudy() {
  const sectionRef = useRef<HTMLElement>(null);
  const outgoingCanvasRef = useRef<HTMLCanvasElement>(null);
  const heldPointerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const transitionRef = useRef<Transition | null>(null);
  const [{ documents, defaults }, setDocumentState] = useState(() => {
    const initialDocuments = createStudyDocuments();
    return {
      documents: initialDocuments,
      defaults: initialDocuments,
    };
  });
  const [activeId, setActiveId] = useState<StudyId>(STUDY_IDS[0]);
  const [hydrated, setHydrated] = useState(false);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [rotation, setRotation] = useState<RotationState>("playing");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const [lastInteraction, setLastInteraction] = useState<number | null>(null);
  const [nextRotationAt, setNextRotationAt] = useState<number | null>(null);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [inView, setInView] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [status, setStatus] = useState("");
  const [statusPolite, setStatusPolite] = useState(false);

  const activeStudy = STUDIES.find((study) => study.id === activeId)!;
  const activeDocument = documents[activeId];
  const controlsDisabled = !hydrated;
  const canRotate =
    hydrated &&
    rotation === "playing" &&
    rendererReady &&
    !rendererError &&
    inView &&
    documentVisible &&
    !pointerActive;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !sectionRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = (matches: boolean) => {
      setReducedMotion(matches);
      if (matches) setRotation("paused");
    };
    updateMotionPreference(media.matches);
    const onChange = (event: MediaQueryListEvent) => updateMotionPreference(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const releasePointer = (event: PointerEvent) => {
      if (heldPointerRef.current !== event.pointerId) return;
      heldPointerRef.current = null;
      setPointerActive(false);
      setLastInteraction(Date.now());
    };
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    return () => {
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
    };
  }, []);

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
  }, []);

  const clearTransition = () => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    transitionRef.current = null;
    setTransition(null);
  };

  const captureOutgoingFrame = (direction: Direction) => {
    clearTransition();
    if (reducedMotion) return;
    const source = sectionRef.current?.querySelector<HTMLCanvasElement>(`.${styles.liveCanvas} canvas`);
    const outgoing = outgoingCanvasRef.current;
    if (!source || !outgoing) return;
    if (outgoing.width !== source.width) outgoing.width = source.width;
    if (outgoing.height !== source.height) outgoing.height = source.height;
    const context = outgoing.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, outgoing.width, outgoing.height);
    context.drawImage(source, 0, 0, outgoing.width, outgoing.height);
    const nextTransition: Transition = { direction, phase: "waiting" };
    transitionRef.current = nextTransition;
    setTransition(nextTransition);
  };

  const noteInteraction = () => {
    setLastInteraction(Date.now());
  };

  const selectStudy = (id: StudyId, message?: string, direction?: Direction) => {
    if (id === activeId) return;
    captureOutgoingFrame(direction ?? (id === previousStudyId(activeId) ? "previous" : "next"));
    setRendererReady(false);
    setRendererError(null);
    setActiveId(id);
    if (message) {
      setStatusPolite(true);
      setStatus(message);
    }
  };

  const updateDocument = (next: StudioDocument, message?: string) => {
    try {
      const checked = validateDocument(next);
      setDocumentState((current) => ({
        ...current,
        documents: { ...current.documents, [activeId]: checked },
      }));
      setRendererError(null);
      if (message) {
        setStatusPolite(true);
        setStatus(message);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setRendererError(message);
      setStatusPolite(true);
      setStatus(`Could not update ${activeStudy.title}: ${message}`);
    }
  };

  const updateLayer = (change: Partial<Layer>, message?: string) => {
    updateDocument({
      ...activeDocument,
      layers: [{ ...activeDocument.layers[0], ...change }],
    }, message);
  };

  const changeParameter = (parameter: NumericParameter, value: number) => {
    noteInteraction();
    updateLayer({ params: { ...activeDocument.layers[0].params, [parameter.key]: value } });
  };

  const changePalette = (paletteId: string) => {
    noteInteraction();
    const choice = PALETTES.find((item) => item.id === paletteId);
    if (!choice) return;
    updateLayer({ palette: choice.values }, `${choice.name} palette selected.`);
  };

  const reseed = () => {
    if (!activeStudy.canReseed) return;
    noteInteraction();
    const seed = (activeDocument.layers[0].seed + 1) >>> 0;
    updateLayer({ seed }, `Seed ${seed}. The study has been sampled again.`);
  };

  const resetStudy = () => {
    noteInteraction();
    setRendererReady(false);
    setRendererError(null);
    updateDocument(defaults[activeId], `${activeStudy.title} reset.`);
  };

  const handleRendererStatus = (message: string | null) => {
    setRendererReady(message === null);
    setRendererError(message);
    if (message) {
      clearTransition();
      setStatusPolite(true);
      setStatus(`Live renderer error: ${message}`);
      return;
    }
    if (transitionRef.current?.phase === "waiting") {
      const activeTransition = { ...transitionRef.current, phase: "active" as const };
      transitionRef.current = activeTransition;
      setTransition(activeTransition);
      transitionTimerRef.current = window.setTimeout(clearTransition, 500);
    }
  };

  const handleCarouselPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest("[data-rotation-control]")) return;
    heldPointerRef.current = event.pointerId;
    setPointerActive(true);
    noteInteraction();
  };


  const handleCarouselFocus = (event: React.FocusEvent<HTMLElement>) => {
    if ((event.target as Element).closest("[data-rotation-control]")) return;
    noteInteraction();
  };

  const handleCarouselKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if ((event.target as Element).closest("[data-rotation-control]")) return;
    noteInteraction();
  };

  const toggleRotation = () => {
    if (rotation === "playing") {
      setRotation("paused");
      setStatusPolite(true);
      setStatus("Rotation paused.");
      return;
    }
    setRotation("playing");
    setLastInteraction(null);
    setNextRotationAt(null);
    setStatusPolite(true);
    setStatus(rendererReady ? "Rotation resumed." : "Rotation will resume when the live study is ready.");
  };

  const goPrevious = () => {
    noteInteraction();
    const id = previousStudyId(activeId);
    selectStudy(id, `Showing ${STUDIES.find((study) => study.id === id)!.title}.`, "previous");
  };

  const goNext = () => {
    noteInteraction();
    const id = nextStudyId(activeId);
    selectStudy(id, `Showing ${STUDIES.find((study) => study.id === id)!.title}.`, "next");
  };

  useEffect(() => {
    if (!canRotate) return;
    if (nextRotationAt === null && lastInteraction === null) {
      setNextRotationAt(Date.now() + 3_000);
      return;
    }
    const deadline = lastInteraction === null ? nextRotationAt! : lastInteraction + 5_000;
    const timer = window.setTimeout(() => {
      const nextStart = Date.now();
      setStatusPolite(false);
      setLastInteraction(null);
      setNextRotationAt(nextStart + 3_000);
      selectStudy(nextStudyId(activeId), undefined, "next");
    }, Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [activeId, canRotate, lastInteraction, nextRotationAt]);

  const previousStudy = STUDIES.find((study) => study.id === previousStudyId(activeId))!;
  const nextStudy = STUDIES.find((study) => study.id === nextStudyId(activeId))!;
  const activePalette = activeDocument.layers[0].palette;

  return (
    <section
      ref={sectionRef}
      className={styles.carousel}
      aria-labelledby="landing-study-title"
      aria-roledescription="carousel"
      data-active-study={activeId}
      data-rotation={rotation}
      onPointerDown={handleCarouselPointerDown}
      onFocusCapture={handleCarouselFocus}
      onKeyDownCapture={handleCarouselKeyDown}
    >
      <div className={styles.topline}>
        <p>Live studies</p>
        <button
          type="button"
          className={styles.rotationButton}
          data-rotation-control
          disabled={controlsDisabled}
          aria-label={rotation === "playing" ? "Pause rotation" : "Resume rotation"}
          onClick={toggleRotation}
        >
          {rotation === "playing" ? "Pause rotation" : "Resume rotation"}
        </button>
      </div>

      <div className={styles.stage}>
        <button
          type="button"
          className={`${styles.peek} ${styles.peekPrevious}`}
          disabled={controlsDisabled}
          aria-label={`Previous study: ${previousStudy.title}`}
          onClick={goPrevious}
        >
          <img src={`/previews/landing/${previousStudy.id}.png`} alt="" width={640} height={640} decoding="async" />
        </button>
        <div
          className={styles.artwork}
          data-ready={rendererReady && !rendererError}
          data-transitioning={transition?.phase === "active" ? "true" : undefined}
          data-direction={transition?.direction}
          role="group"
          aria-label={`${activeStudy.title} live study`}
        >
          <img
            className={styles.previewImage}
            src={`/previews/landing/${activeId}.png`}
            alt={`Static preview of ${activeStudy.title}.`}
            width={640}
            height={640}
            decoding="async"
          />
          <canvas
            ref={outgoingCanvasRef}
            className={styles.outgoingCanvas}
            style={{ visibility: transition ? "visible" : "hidden" }}
            aria-hidden="true"
          />
          <SketchCanvas document={activeDocument} className={styles.liveCanvas} onError={handleRendererStatus} />
        </div>
        <button
          type="button"
          className={`${styles.peek} ${styles.peekNext}`}
          disabled={controlsDisabled}
          aria-label={`Next study: ${nextStudy.title}`}
          onClick={goNext}
        >
          <img src={`/previews/landing/${nextStudy.id}.png`} alt="" width={640} height={640} decoding="async" />
        </button>
      </div>

      <div className={styles.caption}>
        <div>
          <p className={styles.position}>{String(STUDY_IDS.indexOf(activeId) + 1).padStart(2, "0")} / {String(STUDY_IDS.length).padStart(2, "0")}</p>
          <h2 id="landing-study-title">{activeStudy.title}</h2>
        </div>
        <div className={styles.navigation}>
          <button type="button" disabled={controlsDisabled} aria-label="Previous study" onClick={goPrevious}><span aria-hidden="true">←</span></button>
          <button type="button" disabled={controlsDisabled} aria-label="Next study" onClick={goNext}><span aria-hidden="true">→</span></button>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.numericControls}>
          {activeStudy.parameters.map((parameter) => {
            const value = activeDocument.layers[0].params[parameter.key] as number;
            const valueLabel = String(value);
            return (
              <div className={styles.control} key={parameter.key}>
                <label className={styles.controlLabel} htmlFor={`landing-study-${activeId}-${parameter.key}`}>
                  <span>{parameter.label}</span>
                  <output htmlFor={`landing-study-${activeId}-${parameter.key}`} aria-hidden="true">{valueLabel}</output>
                </label>
                <input
                  id={`landing-study-${activeId}-${parameter.key}`}
                  type="range"
                  min={parameter.min}
                  max={parameter.max}
                  step={parameter.step}
                  value={value}
                  disabled={controlsDisabled}
                  aria-label={parameter.label}
                  aria-valuetext={valueLabel}
                  aria-describedby={`landing-hint-${activeId}-${parameter.key}`}
                  onChange={(event) => changeParameter(parameter, Number(event.target.value))}
                />
                <p id={`landing-hint-${activeId}-${parameter.key}`} className={styles.controlHint}>{parameter.description}</p>
              </div>
            );
          })}
        </div>
        <div className={styles.controlFooter}>
          <fieldset className={styles.palettes}>
            <legend>Palette</legend>
            <div className={styles.paletteChoices}>
              {PALETTES.map((choice) => {
                const palette = choice.values;
                const selected = palette.length === activePalette.length && palette.every((value, index) => value === activePalette[index]);
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={styles.paletteButton}
                    disabled={controlsDisabled}
                    aria-pressed={selected}
                    onClick={() => changePalette(choice.id)}
                  >
                    <span aria-hidden="true">{choice.colors.map((value) => <span key={value} style={{ backgroundColor: value }} />)}</span>
                    {choice.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className={styles.actions}>
            {activeStudy.canReseed && <button type="button" disabled={controlsDisabled} onClick={reseed}>Reseed</button>}
            <button type="button" disabled={controlsDisabled} aria-label="Reset study" onClick={resetStudy}>Reset</button>
            <Link href={`/techniques/${activeId}`}>Open study <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </div>

      <div className={styles.studyPicker} role="group" aria-label="Choose a live study">
        {STUDIES.map((study) => (
          <button
            key={study.id}
            type="button"
            className={styles.studyButton}
            disabled={controlsDisabled}
            aria-label={`Show ${study.title}`}
            aria-pressed={activeId === study.id}
            onClick={() => {
              noteInteraction();
              selectStudy(study.id, `Showing ${study.title}.`);
            }}
          >
            <img src={`/previews/landing/${study.id}.png`} alt="" width={160} height={160} loading="lazy" decoding="async" />
            <span>{study.title}</span>
          </button>
        ))}
      </div>

      {rendererError && <p className={styles.error} role="status">Live renderer error: {rendererError}</p>}
      <p className={styles.status} role="status" aria-live={statusPolite ? "polite" : "off"}>{status}</p>
      <noscript><p>JavaScript is required for the live controls. The study previews remain available.</p></noscript>
    </section>
  );
}
