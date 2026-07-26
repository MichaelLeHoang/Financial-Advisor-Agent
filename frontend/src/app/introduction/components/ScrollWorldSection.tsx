"use client";

import type { CSSProperties, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useHydratedReducedMotion } from "@/hooks/useHydratedReducedMotion";
import {
  clamp,
  getScrollWorldSceneTarget,
  resolveScrollWorldState,
  type ScrollWorldConfig,
} from "@/lib/scroll-world";
import { loginHref } from "@/lib/workspace-routing";

import { trackLandingEvent } from "./landing-analytics";
import styles from "./ScrollWorldSection.module.css";

const SCENE_MEDIA_ROOT = "/scroll-world/quanfora/scenes";
const SCENE_MEDIA_VERSION = "20260725-four-clips";
const sceneMedia = (filename: string) => `${SCENE_MEDIA_ROOT}/${filename}?v=${SCENE_MEDIA_VERSION}`;

const SCROLL_WORLD_CONFIG: ScrollWorldConfig = {
  embedded: true,
  showTopbar: false,
  scenes: [
    {
      id: "signal",
      label: "Signal",
      accent: "#58bfc2",
      eyebrow: "01 · Market intake",
      title: "Start with the signal, not the noise.",
      body: "Quotes, news, sentiment, and fundamentals enter one structured research path.",
      tags: ["Market data", "News", "Sentiment"],
      scroll: 0.9,
      linger: 0.18,
      clip: sceneMedia("scene-01-signal.mp4"),
      still: sceneMedia("scene-01-signal.jpg"),
    },
    {
      id: "consensus",
      label: "Agents",
      accent: "#a878b5",
      eyebrow: "02 · Multi-agent research",
      title: "Let specialists disagree.",
      body: "Quant, risk, market, and data perspectives remain distinct before a conclusion is formed.",
      tags: ["Consensus", "Quant", "Research"],
      scroll: 0.9,
      linger: 0.2,
      clip: sceneMedia("scene-02-agents.mp4"),
      still: sceneMedia("scene-02-agents.jpg"),
    },
    {
      id: "risk",
      label: "Risk",
      accent: "#d9a441",
      eyebrow: "03 · Risk gate",
      title: "Put risk before action.",
      body: "Exposure, valuation, drawdown, and sizing checks challenge the idea before capital does.",
      tags: ["Exposure", "VaR", "Guardrails"],
      scroll: 0.88,
      linger: 0.18,
      clip: sceneMedia("scene-03-risk.mp4"),
      still: sceneMedia("scene-03-risk.jpg"),
    },
    {
      id: "decision",
      label: "Decision",
      accent: "#7776c9",
      eyebrow: "04 · Documented decision",
      title: "Act with a record, not a hunch.",
      body: "Turn the final thesis, risk limits, and next steps into a decision you can revisit.",
      tags: ["Thesis", "Journal", "Paper trading"],
      scroll: 1.08,
      linger: 0.26,
      clip: sceneMedia("scene-04-decision.mp4"),
      still: sceneMedia("scene-04-decision.jpg"),
      cta: { primary: "Launch App", secondary: "View sample research" },
    },
  ],
};

const SCENES = SCROLL_WORLD_CONFIG.scenes;

export function ScrollWorldSection() {
  const { user, loading } = useAuth();
  const reduceMotion = useHydratedReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);
  const clipUrlsRef = useRef(new Map<string, string>());
  const viewedScenesRef = useRef(new Set<string>());
  const hasTrackedSectionRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [compactJourney, setCompactJourney] = useState(false);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [loadedMedia, setLoadedMedia] = useState<{ sceneId: string; url: string } | null>(null);
  const [readySceneId, setReadySceneId] = useState<string | null>(null);

  const scrollUnits = SCENES.reduce((total, scene) => total + scene.scroll, 0);
  const sectionStyle = { height: `${Math.round((scrollUnits + 1) * 100)}svh` };

  const trackScene = useCallback((index: number) => {
    const scene = SCENES[index];
    if (!scene || viewedScenesRef.current.has(scene.id)) return;
    viewedScenesRef.current.add(scene.id);
    trackLandingEvent("landing_scroll_world_scene_view", {
      scene_id: scene.id,
      scene_index: index,
      scene_label: scene.label,
    });
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px), (hover: none) and (pointer: coarse)");
    const update = () => setCompactJourney(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSectionVisible(entry.isIntersecting);
        if (!entry.isIntersecting || hasTrackedSectionRef.current) return;
        hasTrackedSectionRef.current = true;
        trackLandingEvent("landing_scroll_world_view", { location: "decision_world" });
        trackScene(activeIndexRef.current);
      },
      { threshold: 0.01 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [trackScene]);

  useEffect(() => {
    if (reduceMotion || compactJourney) return;
    const scene = SCENES[activeIndex];
    const cachedUrl = clipUrlsRef.current.get(scene.clip);
    const controller = new AbortController();
    let cancelled = false;

    setReadySceneId(null);
    setLoadedMedia(null);

    if (cachedUrl) {
      setLoadedMedia({ sceneId: scene.id, url: cachedUrl });
      return () => controller.abort();
    }

    fetch(scene.clip, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load scroll-world scene: ${scene.clip}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        clipUrlsRef.current.set(scene.clip, objectUrl);
        setLoadedMedia({ sceneId: scene.id, url: objectUrl });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError") && !cancelled) {
          setLoadedMedia(null);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeIndex, compactJourney, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || compactJourney) return;
    const nextScene = SCENES[activeIndex + 1];
    if (!nextScene || clipUrlsRef.current.has(nextScene.clip)) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      fetch(nextScene.clip, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Unable to prefetch scroll-world scene: ${nextScene.clip}`);
          return response.blob();
        })
        .then((blob) => {
          if (controller.signal.aborted || clipUrlsRef.current.has(nextScene.clip)) return;
          clipUrlsRef.current.set(nextScene.clip, URL.createObjectURL(blob));
        })
        .catch(() => undefined);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeIndex, compactJourney, reduceMotion]);

  useEffect(() => () => {
    for (const objectUrl of clipUrlsRef.current.values()) URL.revokeObjectURL(objectUrl);
    clipUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (reduceMotion || compactJourney) return;
    const section = sectionRef.current;
    const viewport = viewportRef.current;
    if (!section || !viewport) return;

    const read = () => {
      animationFrameRef.current = null;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const progress = clamp(-rect.top / scrollable);
      const state = resolveScrollWorldState(progress, SCENES);

      viewport.style.setProperty("--journey-progress", state.journeyProgress.toFixed(4));
      viewport.dataset.sceneProgress = state.sceneProgress.toFixed(4);

      if (state.sceneIndex !== activeIndexRef.current) {
        activeIndexRef.current = state.sceneIndex;
        setActiveIndex(state.sceneIndex);
        if (rect.top < window.innerHeight && rect.bottom > 0) trackScene(state.sceneIndex);
      }
    };

    const requestRead = () => {
      if (animationFrameRef.current === null) animationFrameRef.current = window.requestAnimationFrame(read);
    };

    const resizeObserver = new ResizeObserver(requestRead);
    resizeObserver.observe(section);
    window.addEventListener("scroll", requestRead, { passive: true });
    window.addEventListener("resize", requestRead);
    requestRead();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", requestRead);
      window.removeEventListener("resize", requestRead);
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [compactJourney, reduceMotion, trackScene]);

  const jumpToScene = useCallback((index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
    const target = sectionTop + getScrollWorldSceneTarget(index, SCENES) * scrollable;
    window.scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });
  }, [reduceMotion]);

  const handleLaunchApp = () => {
    trackLandingEvent("landing_launch_app_click", { location: "scroll_world_finale" });
    window.localStorage.setItem("financial-advisor.coverSeen", "true");
    window.location.href = !loading && !user.is_guest ? "/home" : loginHref("/home");
  };

  if (reduceMotion || compactJourney) {
    return (
      <StaticJourney
        sectionRef={sectionRef}
        onLaunchApp={handleLaunchApp}
        compact={compactJourney && !reduceMotion}
      />
    );
  }

  const activeScene = SCENES[activeIndex];
  const videoReady = readySceneId === activeScene.id;

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      style={sectionStyle}
      aria-label="From market signal to documented decision"
      data-testid="scroll-world-section"
    >
      <div
        ref={viewportRef}
        className={styles.viewport}
        data-scene-id={activeScene.id}
        data-scene-progress="0.0000"
      >
        <div className={styles.progressTrack} aria-hidden="true" data-testid="scroll-world-progress"><span /></div>

        <div className={styles.sceneShell}>
          <div className={styles.mediaColumn}>
            <div className={styles.stage} aria-hidden="true" data-testid="scroll-world-stage">
              <img
                key={activeScene.still}
                src={activeScene.still}
                alt=""
                className={`${styles.poster} ${videoReady ? styles.posterHidden : ""}`}
                decoding="async"
              />
              {loadedMedia?.sceneId === activeScene.id ? (
                <video
                  key={activeScene.id}
                  ref={videoRef}
                  src={loadedMedia.url}
                  className={`${styles.video} ${videoReady ? styles.videoReady : ""}`}
                  data-scene-id={activeScene.id}
                  muted
                  playsInline
                  preload="auto"
                  tabIndex={-1}
                  onLoadedData={(event) => {
                    event.currentTarget.currentTime = 0;
                    event.currentTarget.play().catch(() => setReadySceneId(null));
                  }}
                  onPlaying={() => setReadySceneId(activeScene.id)}
                />
              ) : null}
            </div>
          </div>

          <div className={styles.copyColumn}>
            <div className={styles.copyLayer}>
              <AnimatePresence mode="wait">
                {sectionVisible ? (
                  <motion.article
                    key={activeScene.id}
                    className={styles.copy}
                    style={{ "--scene-accent": activeScene.accent } as CSSProperties}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12, transition: { duration: 0.14, ease: "easeOut" } }}
                    transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <span className={styles.eyebrow}>{activeScene.eyebrow}</span>
                    <h2>{activeScene.title}</h2>
                    <p>{activeScene.body}</p>
                    <ul aria-label={`${activeScene.label} capabilities`}>
                      {activeScene.tags.map((tag) => <li key={tag}>{tag}</li>)}
                    </ul>
                    {activeScene.cta ? (
                      <div className={styles.actions}>
                        <button type="button" onClick={handleLaunchApp} data-analytics-id="landing-scroll-world-launch-app">
                          {activeScene.cta.primary}<ArrowRight aria-hidden="true" />
                        </button>
                        <a
                          href="#samples"
                          onClick={() => trackLandingEvent("landing_sample_research_click", { location: "scroll_world_finale" })}
                          data-analytics-id="landing-scroll-world-view-samples"
                        >
                          {activeScene.cta.secondary}
                        </a>
                      </div>
                    ) : null}
                  </motion.article>
                ) : null}
              </AnimatePresence>
            </div>

            <nav className={styles.route} aria-label="Research decision journey">
              {SCENES.map((scene, index) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => jumpToScene(index)}
                  className={index === activeIndex ? styles.routeActive : undefined}
                  aria-current={index === activeIndex ? "step" : undefined}
                  aria-label={`Go to ${scene.label}: ${scene.title}`}
                  style={{ "--scene-accent": scene.accent } as CSSProperties}
                >
                  <span>{scene.label}</span><i />
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className={`${styles.scrollHint} ${activeIndex > 0 ? styles.scrollHintHidden : ""}`} aria-hidden="true">
          <ArrowDown /><span>Scroll to move through the world</span>
        </div>
      </div>
    </section>
  );
}

function StaticJourney({
  sectionRef,
  onLaunchApp,
  compact,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  onLaunchApp: () => void;
  compact: boolean;
}) {
  return (
    <section
      ref={sectionRef}
      className={styles.staticSection}
      aria-label="From market signal to documented decision"
      data-testid="scroll-world-section"
      data-static-reason={compact ? "portrait-mobile" : "reduced-motion"}
    >
      <div className={styles.staticIntro}>
        <p>Quanfora decision world</p>
        <h2>From market signal to a decision you can defend.</h2>
        <span>{compact ? "Desktop film shown as a frame-safe preview on phones." : "Motion is reduced to a frame-safe overview."}</span>
      </div>
      <figure className={styles.staticPoster}>
        <img src={SCENES[0].still} alt="An isometric miniature world representing Quanfora's research workflow" />
      </figure>
      <div className={styles.staticGrid}>
        {SCENES.map((scene) => (
          <article key={scene.id} style={{ "--scene-accent": scene.accent } as CSSProperties}>
            <span>{scene.eyebrow}</span>
            <h3>{scene.title}</h3>
            <p>{scene.body}</p>
            <ul>{scene.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
            {scene.cta ? (
              <div className={styles.staticActions}>
                <button type="button" onClick={onLaunchApp}>{scene.cta.primary}</button>
                <a href="#samples" onClick={() => trackLandingEvent("landing_sample_research_click", { location: "scroll_world_finale" })}>
                  {scene.cta.secondary}
                </a>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
