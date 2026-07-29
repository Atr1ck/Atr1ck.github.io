import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Article } from "../../types/article";
import { ContentTag } from "./NanYueTheme";

const EXIT_FALLBACK_DURATION_MS = 1200;

function EnvelopeFace({ article }: { article: Article }) {
  return (
    <>
      <span className="nan-yue-envelope-flap" aria-hidden="true" />
      <span className="nan-yue-envelope-upper-creases" aria-hidden="true" />
      <span className="nan-yue-envelope-pocket" aria-hidden="true" />
      <span className="nan-yue-envelope-seam nan-yue-envelope-seam-left" aria-hidden="true" />
      <span className="nan-yue-envelope-seam nan-yue-envelope-seam-right" aria-hidden="true" />
      <span className="nan-yue-envelope-stamp" aria-hidden="true">
        <span>♡</span>
        <span>♥</span>
      </span>
      <span className="nan-yue-envelope-seal" aria-hidden="true">N &amp; Y</span>
      <span className="nan-yue-envelope-title">{article.title}</span>
      <time className="nan-yue-envelope-date" dateTime={article.date}>{article.date}</time>
      <span className="nan-yue-envelope-tagline"><ContentTag tag="Nan & Yue" /></span>
    </>
  );
}

function EnvelopeLetter({ article, ready, onOpen, onReady }: { article: Article; ready: boolean; onOpen: () => void; onReady: () => void }) {
  return (
    <button
      type="button"
      className={`nan-yue-envelope-letter ${ready ? "nan-yue-envelope-letter-ready" : ""}`}
      disabled={!ready}
      aria-label={`阅读情书 ${article.title}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === "nan-yue-envelope-letter") onReady();
      }}
    >
      <span className="nan-yue-envelope-letter-kicker">Nan &amp; Yue</span>
      <strong>{article.title}</strong>
      <time dateTime={article.date}>{article.date}</time>
      {article.summary ? <p>{article.summary}</p> : <span className="nan-yue-envelope-letter-rule" />}
    </button>
  );
}

function getAnimationStyle(element: HTMLElement): CSSProperties {
  const rect = element.getBoundingClientRect();
  const scale = Math.min(1.35, (window.innerWidth - 32) / rect.width, (window.innerHeight - 32) / rect.height);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    "--nan-yue-envelope-dx": `${window.innerWidth / 2 - centerX}px`,
    "--nan-yue-envelope-dy": `${window.innerHeight / 2 - centerY}px`,
    "--nan-yue-envelope-scale": `${scale}`,
  } as CSSProperties;
}

export default function NanYueEnvelopeCard({ article, onOpen }: { article: Article; onOpen: () => void }) {
  const cardRef = useRef<HTMLElement>(null);
  const finishedRef = useRef(false);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [animationStyle, setAnimationStyle] = useState<CSSProperties>();

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onOpen();
  }, [onOpen]);

  const openEnvelope = () => {
    if (opening || !cardRef.current) return;
    finishedRef.current = false;
    setReady(false);
    setExiting(false);
    setAnimationStyle(getAnimationStyle(cardRef.current));
    setOpening(true);
  };

  const closeEnvelope = useCallback(() => {
    if (exiting) return;
    setOpening(false);
    setReady(false);
  }, [exiting]);

  const startExit = () => {
    if (!ready || exiting) return;
    setExiting(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEnvelope();
    }
  };

  useEffect(() => {
    if (!opening) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeEnvelope();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setReady(true);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeEnvelope, opening]);

  useEffect(() => {
    if (!exiting) return;
    const fallback = window.setTimeout(finish, EXIT_FALLBACK_DURATION_MS);
    return () => window.clearTimeout(fallback);
  }, [exiting, finish]);

  return (
    <>
      <article
        ref={cardRef}
        className={`nan-yue-surface nan-yue-envelope-card mb-4 flex w-full max-w-4xl cursor-pointer flex-col rounded-lg border p-4 text-base-content shadow-sm transition-all duration-300 sm:mb-5 sm:p-6 ${opening ? "invisible" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`打开情书 ${article.title}`}
        onClick={openEnvelope}
        onKeyDown={handleKeyDown}
      >
        <EnvelopeFace article={article} />
      </article>
      {opening && animationStyle && createPortal((
        <div
          className={`nan-yue-envelope-stage ${exiting ? "nan-yue-envelope-stage-exiting" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={`正在打开情书 ${article.title}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeEnvelope();
          }}
        >
          <article
            className={`nan-yue-surface nan-yue-envelope-card nan-yue-envelope-float ${exiting ? "nan-yue-envelope-exiting" : ""}`}
            style={animationStyle}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && event.animationName === "nan-yue-envelope-exit") finish();
            }}
          >
            <EnvelopeFace article={article} />
            <EnvelopeLetter article={article} ready={ready && !exiting} onOpen={startExit} onReady={() => setReady(true)} />
          </article>
        </div>
      ), document.body)}
    </>
  );
}
