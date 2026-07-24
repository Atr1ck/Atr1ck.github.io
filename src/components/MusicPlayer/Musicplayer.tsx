import { useCallback, useEffect, useRef, useState } from "react";
import { Element, scroller } from "react-scroll";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import type { LyricLine } from "../../types/musicplayer";
import { formatTime, useAudioPlayer, useLyrics, usePlaylist } from "./musichooks";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const resumeAfterTrackChange = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [listShow, setListShow] = useState(false);
  const [activeLyricIndex, setActiveLyricIndex] = useState(0);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading: isAudioLoading,
    error: audioError,
    play,
    togglePlay,
    handleVolumeChange,
  } = useAudioPlayer(audioRef);

  const {
    musicId,
    title,
    author,
    songList,
    isLoading: isPlaylistLoading,
    error: playlistError,
    nextSong,
    prevSong,
    setMusicId,
  } = usePlaylist();

  const { lyrics, isLoading: isLyricsLoading, error: lyricsError } = useLyrics(title, author);

  const changeSong = useCallback((change: () => void) => {
    resumeAfterTrackChange.current = isPlaying;
    change();
  }, [isPlaying]);

  const selectSong = useCallback((index: number) => {
    if (index === musicId) {
      setListShow(false);
      return;
    }

    resumeAfterTrackChange.current = isPlaying;
    setMusicId(index);
    setListShow(false);
  }, [isPlaying, musicId, setMusicId]);

  const handleEnded = useCallback(() => {
    resumeAfterTrackChange.current = true;
    nextSong();
  }, [nextSong]);

  const handleProgressChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) audioRef.current.currentTime = Number(event.target.value);
  }, []);

  useEffect(() => {
    if (!title || !resumeAfterTrackChange.current) return;

    resumeAfterTrackChange.current = false;
    void play();
  }, [author, play, title]);

  useEffect(() => {
    if (!panelRef.current) return;

    if (isOpen) {
      panelRef.current.removeAttribute("inert");
    } else {
      panelRef.current.setAttribute("inert", "");
    }
  }, [isOpen]);

  useEffect(() => {
    const activeLyric = lyrics.findIndex(
      (lyric: LyricLine, index: number) =>
        currentTime >= lyric.time &&
        (index === lyrics.length - 1 || currentTime < lyrics[index + 1].time),
    );

    if (activeLyric === -1 || activeLyric === activeLyricIndex) return;

    setActiveLyricIndex(activeLyric);
    scroller.scrollTo(`lyric-${activeLyric}`, {
      duration: 250,
      smooth: true,
      offset: -56,
      containerId: "lyrics-container",
    });
  }, [activeLyricIndex, currentTime, lyrics]);

  const statusError = audioError ?? playlistError;
  const trackLabel = title ? `${title} - ${author}` : "音乐播放器";

  return (
    <div className="fixed bottom-3 left-3 z-[60] md:bottom-5 md:left-5">
      <audio
        ref={audioRef}
        src={title ? `/music/${title}-${author}.mp3` : undefined}
        preload="metadata"
        onEnded={handleEnded}
      />

      <section
        ref={panelRef}
        className={`absolute bottom-14 left-0 flex h-[31rem] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-base-300/70 bg-base-100/95 text-base-content shadow-2xl backdrop-blur-xl transition-all duration-200 ${
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
        aria-label="音乐播放器"
        aria-hidden={!isOpen}
      >
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-base-300 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-content">
            <Music2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{title || "正在载入歌曲"}</p>
            <p className="truncate text-sm text-base-content/60">{author || "请稍候"}</p>
          </div>
          <button
            type="button"
            className={`btn btn-ghost btn-square btn-sm ${listShow ? "bg-base-200" : ""}`}
            aria-label={listShow ? "显示歌词" : "显示播放列表"}
            title={listShow ? "显示歌词" : "显示播放列表"}
            onClick={() => setListShow((visible) => !visible)}
          >
            <ListMusic size={19} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-square btn-sm"
            aria-label="收起播放器"
            title="收起播放器"
            onClick={() => setIsOpen(false)}
          >
            <X size={19} />
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          {listShow ? (
            <div className="h-full overflow-y-auto p-3" aria-label="播放列表">
              {songList.map((song, index) => (
                <button
                  type="button"
                  key={`${song.title}-${song.author}`}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                    index === musicId ? "bg-primary/12 text-primary" : "hover:bg-base-200"
                  }`}
                  aria-current={index === musicId ? "true" : undefined}
                  onClick={() => selectSong(index)}
                >
                  <span className="w-5 text-center text-xs tabular-nums text-base-content/45">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{song.title}</span>
                    <span className="block truncate text-xs text-base-content/55">{song.author}</span>
                  </span>
                  {index === musicId && <Music2 size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
          ) : (
            <div
              className="h-full overflow-y-auto px-4 py-3 scroll-smooth"
              id="lyrics-container"
              aria-live="polite"
            >
              {isLyricsLoading && <p className="py-12 text-center text-sm text-base-content/55">歌词加载中...</p>}
              {!isLyricsLoading && lyricsError && (
                <p className="py-12 text-center text-sm text-base-content/55">{lyricsError}</p>
              )}
              {!isLyricsLoading && !lyricsError && lyrics.map((lyric, index) => (
                <Element
                  key={`${lyric.time}-${index}`}
                  name={`lyric-${index}`}
                  className={`px-2 py-2 text-center transition-all duration-150 ${
                    index === activeLyricIndex
                      ? "font-semibold text-primary"
                      : "text-sm text-base-content/55"
                  }`}
                >
                  {lyric.text}
                </Element>
              ))}
            </div>
          )}

          {isPlaylistLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-base-100/80 backdrop-blur-sm">
              <span className="loading loading-spinner loading-md" aria-label="播放列表加载中" />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-base-300 px-4 pb-4 pt-3">
          {statusError && (
            <p className="mb-2 rounded-md bg-error/10 px-3 py-2 text-xs text-error" role="status">
              {statusError}
            </p>
          )}

          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 text-xs tabular-nums text-base-content/55">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              aria-label="播放进度"
              value={Math.min(currentTime, duration || 0)}
              min="0"
              max={duration || 0}
              step="0.1"
              onChange={handleProgressChange}
              className="range range-primary range-xs w-full"
              disabled={!duration}
            />
            <span className="text-right">{formatTime(duration)}</span>
          </div>

          <div className="mt-3 flex h-12 items-center justify-center gap-3">
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="上一首"
              title="上一首"
              disabled={songList.length === 0}
              onClick={() => changeSong(prevSong)}
            >
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-circle h-11 w-11"
              aria-label={isPlaying ? "暂停" : "播放"}
              title={isPlaying ? "暂停" : "播放"}
              disabled={!title || isAudioLoading}
              onClick={togglePlay}
            >
              {isAudioLoading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" className="translate-x-px" />
              )}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="下一首"
              title="下一首"
              disabled={songList.length === 0}
              onClick={() => changeSong(nextSong)}
            >
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <Volume2 size={17} className="shrink-0 text-base-content/55" />
            <input
              type="range"
              aria-label="音量"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="range range-primary range-xs w-full"
            />
          </div>
        </div>
      </section>

      <button
        type="button"
        className="flex h-12 max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-lg border border-base-300/70 bg-base-100/95 px-3 text-base-content shadow-lg backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-xl"
        aria-label={isOpen ? "收起音乐播放器" : "展开音乐播放器"}
        aria-expanded={isOpen}
        title={isOpen ? "收起音乐播放器" : "展开音乐播放器"}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-content ${isPlaying ? "animate-pulse" : ""}`}>
          <Music2 size={17} />
        </span>
        <span className="hidden max-w-52 truncate text-sm font-medium sm:block">{trackLabel}</span>
        {isOpen ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
      </button>
    </div>
  );
}
