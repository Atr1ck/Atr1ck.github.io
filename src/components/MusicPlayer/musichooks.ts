import { useCallback, useEffect, useState } from "react";
import type { LyricLine, Song } from "../../types/musicplayer";

const useAudioPlayer = (audioRef: React.RefObject<HTMLAudioElement>) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setError(null);
    try {
      await audio.play();
    } catch (playError) {
      const message = playError instanceof Error ? playError.message : "未知错误";
      setError(`播放失败: ${message}`);
    }
  }, [audioRef]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void play();
    } else {
      audio.pause();
    }
  }, [audioRef, play]);

  const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(event.target.value);
    if (!audioRef.current) return;

    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  }, [audioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setError("音频加载失败");
      setIsLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadeddata", handleCanPlay);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadeddata", handleCanPlay);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [audioRef]);

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading,
    error,
    play,
    togglePlay,
    handleVolumeChange,
  };
};

const useLyrics = (title: string, author: string) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!title || !author) {
      setLyrics([]);
      return;
    }

    const controller = new AbortController();

    const fetchLyrics = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/lyrics/${title}-${author}.lrc`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("歌词加载失败");

        const data = await response.text();
        setLyrics(parseLRC(data));
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "歌词加载失败");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void fetchLyrics();
    return () => controller.abort();
  }, [title, author]);

  return { lyrics, isLoading, error };
};

const usePlaylist = () => {
  const [musicId, setMusicId] = useState(0);
  const [songList, setSongList] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchPlaylist = async () => {
      setError(null);
      try {
        const response = await fetch("/json/music.json", { signal: controller.signal });
        if (!response.ok) throw new Error("播放列表加载失败");

        const data = await response.json() as { title?: string[]; author?: string[] };
        const titles = Array.isArray(data.title) ? data.title : [];
        const authors = Array.isArray(data.author) ? data.author : [];
        const songs = titles.map((title, index) => ({
          title,
          author: authors[index] ?? "未知作者",
        }));

        if (songs.length === 0) throw new Error("播放列表为空");
        setSongList(songs);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "播放列表加载失败");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void fetchPlaylist();
    return () => controller.abort();
  }, []);

  const nextSong = useCallback(() => {
    if (songList.length === 0) return;
    setMusicId((currentId) => (currentId + 1) % songList.length);
  }, [songList.length]);

  const prevSong = useCallback(() => {
    if (songList.length === 0) return;
    setMusicId((currentId) => (currentId - 1 + songList.length) % songList.length);
  }, [songList.length]);

  const currentSong = songList[musicId] ?? { title: "", author: "" };

  return {
    musicId,
    title: currentSong.title,
    author: currentSong.author,
    songList,
    isLoading,
    error,
    nextSong,
    prevSong,
    setMusicId,
  };
};

const formatTime = (time: number) => {
  if (!Number.isFinite(time) || time < 0) return "00:00";

  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const parseLRC = (lrc: string): LyricLine[] => {
  const parsed: LyricLine[] = [];

  lrc.split("\n").forEach((line) => {
    const timeTagPattern = /\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/g;
    const text = line.replace(timeTagPattern, "").trim();
    if (!text) return;

    let match = timeTagPattern.exec(line);
    while (match) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseFloat(match[2]);
      parsed.push({ time: minutes * 60 + seconds, text });
      match = timeTagPattern.exec(line);
    }
  });

  return parsed.sort((first, second) => first.time - second.time);
};

export { formatTime, useAudioPlayer, useLyrics, usePlaylist };
