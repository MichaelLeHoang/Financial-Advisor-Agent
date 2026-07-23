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
  resolveScrollWorldVideoProgress,
  type ScrollWorldConfig,
} from "@/lib/scroll-world";
import { loginHref } from "@/lib/workspace-routing";

import { trackLandingEvent } from "./landing-analytics";
import styles from "./ScrollWorldSection.module.css";

const VIDEO_SOURCE = "/scroll-world/quanfora/scroll-scene-scrub.mp4";
const VIDEO_POSTER = "/scroll-world/quanfora/scroll-scene-poster.jpg";

const SCROLL_WORLD_CONFIG: ScrollWorldConfig = {
  embedded: true,
  showTopbar: false,
  crossfade: 0.08,
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
      videoStart: 0,
      videoEnd: 0.15,
    },
    {
      id: "evidence",
      label: "Evidence",
      accent: "#8e8cd8",
      eyebrow: "02 · Grounded context",
      title: "Keep the evidence attached.",
      body: "Sources, assumptions, and caveats stay visible as the thesis takes shape.",
      tags: ["Filings", "Citations", "Memory"],
      scroll: 0.8,
      linger: 0.16,
      videoStart: 0.15,
      videoEnd: 0.31,
    },
    {
      id: "consensus",
      label: "Agents",
      accent: "#a878b5",
      eyebrow: "03 · Multi-agent research",
      title: "Let specialists disagree.",
      body: "Quant, risk, market, and data perspectives remain distinct before a conclusion is formed.",
      tags: ["Consensus", "Quant", "Research"],
      scroll: 0.88,
      linger: 0.2,
      videoStart: 0.31,
      videoEnd: 0.48,
    },
    {
      id: "risk",
      label: "Risk",
      accent: "#d9a441",
      eyebrow: "04 · Risk gate",
      title: "Put risk before action.",
      body: "Exposure, valuation, drawdown, and sizing checks challenge the idea before capital does.",
      tags: ["Exposure", "VaR", "Guardrails"],
      scroll: 0.84,
      linger: 0.16,
      videoStart: 0.48,
      videoEnd: 0.64,
    },
    {
      id: "portfolio",
      label: "Portfolio",
      accent: "#78a98b",
      eyebrow: "05 · Portfolio construction",
      title: "See the decision in context.",
      body: "Compare classical and quantum allocation paths against the portfolio you already own.",
      tags: ["Allocation", "Backtests", "Quantum"],
      scroll: 0.9,
      linger: 0.18,
      videoStart: 0.64,
      videoEnd: 0.82,
    },
    {
      id: "decision",
      label: "Decision",
      accent: "#7776c9",
      eyebrow: "06 · Documented decision",
      title: "Act with a record, not a hunch.",
      body: "Turn the final thesis, risk limits, and next steps into a decision you can revisit.",
      tags: ["Thesis", "Journal", "Paper trading"],
      scroll: 1.08,
      linger: 0.26,
      videoStart: 0.82,
      videoEnd: 1,
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
  const targetVideoProgressRef = useRef(0);
  const activeIndexRef = useRef(0);
  const viewedScenesRef = useRef(new Set<string>());
  const hasTrackedSectionRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [compactJourney, setCompactJourney] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

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

  const syncVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || video.seeking) return;
    const target = Math.min(video.duration - 1 / 24, targetVideoProgressRef.current * video.duration);
    if (Math.abs(video.currentTime - target) > 0.025) video.currentTime = Math.max(0, target);
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
        if (!entry.isIntersecting || hasTrackedSectionRef.current) return;
        hasTrackedSectionRef.current = true;
        trackLandingEvent("landing_scroll_world_view", { location: "decision_world" });
        trackScene(activeIndexRef.current);
      },
      { threshold: 0.12 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [trackScene]);

  useEffect(() => {
    if (reduceMotion || compactJourney) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;

    setVideoReady(false);
    fetch(VIDEO_SOURCE, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load scroll-world film: ${VIDEO_SOURCE}`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setVideoUrl(null);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setVideoUrl(null);
    };
  }, [compactJourney, reduceMotion]);

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
      const videoProgress = resolveScrollWorldVideoProgress(progress, SCENES);

      viewport.style.setProperty("--journey-progress", state.journeyProgress.toFixed(4));
      viewport.dataset.videoProgress = videoProgress.toFixed(4);
      targetVideoProgressRef.current = videoProgress;
      syncVideo();

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
  }, [compactJourney, reduceMotion, syncVideo, trackScene]);

  useEffect(() => {
    if (reduceMotion || compactJourney) return;
    const primeVideo = () => {
      const video = videoRef.current;
      if (!video) return;
      const promise = video.play();
      if (promise) promise.then(() => video.pause()).catch(() => undefined);
    };
    window.addEventListener("pointerdown", primeVideo, { once: true, passive: true });
    return () => window.removeEventListener("pointerdown", primeVideo);
  }, [compactJourney, reduceMotion]);

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

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      style={sectionStyle}
      aria-label="From market signal to documented decision"
      data-testid="scroll-world-section"
    >
      <div ref={viewportRef} className={styles.viewport} data-video-progress="0.0000">
        <div className={styles.progressTrack} aria-hidden="true" data-testid="scroll-world-progress"><span /></div>

        <div className={styles.stage} aria-hidden="true">
          <img
            src={VIDEO_POSTER}
            alt=""
            className={`${styles.poster} ${videoReady ? styles.posterHidden : ""}`}
            decoding="async"
          />
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className={`${styles.video} ${videoReady ? styles.videoReady : ""}`}
              muted
              playsInline
              preload="auto"
              tabIndex={-1}
              onLoadedMetadata={syncVideo}
              onLoadedData={() => setVideoReady(true)}
              onSeeked={() => {
                setVideoReady(true);
                window.requestAnimationFrame(syncVideo);
              }}
            />
          ) : null}
          <div className={styles.stageShade} />
        </div>

        <div className={styles.copyLayer}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              key={activeScene.id}
              className={styles.copy}
              style={{ "--scene-accent": activeScene.accent } as CSSProperties}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
        <img src={VIDEO_POSTER} alt="An isometric miniature world representing Quanfora's research workflow" />
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
