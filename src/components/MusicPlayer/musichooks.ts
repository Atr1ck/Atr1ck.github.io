import { useState, useCallback, useEffect } from "react";
import { LyricLine, Song } from "../../types/musicplayer";

const useAudioPlayer = (audioRef: React.RefObject<HTMLAudioElement>) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const togglePlay = useCallback(() => {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          setError("播放失败: " + err.message);
        });
      }
      setIsPlaying(!isPlaying);
    }, [isPlaying, audioRef]);
  
    const handleVolumeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = Number(event.target.value);
      if (audioRef.current) {
        audioRef.current.volume = newVolume;
        setVolume(newVolume);
      }
    }, [audioRef]);
  
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
  
      const updateTime = () => setCurrentTime(audio.currentTime);
      const handleLoadStart = () => setIsLoading(true);
      const handleLoadedData = () => setIsLoading(false);
      const handleError = () => {
        setError("音频加载失败");
        setIsLoading(false);
      };
  
      audio.addEventListener("timeupdate", updateTime);
      audio.addEventListener("loadstart", handleLoadStart);
      audio.addEventListener("loadeddata", handleLoadedData);
      audio.addEventListener("error", handleError);
  
      return () => {
        audio.removeEventListener("timeupdate", updateTime);
        audio.removeEventListener("loadstart", handleLoadStart);
        audio.removeEventListener("loadeddata", handleLoadedData);
        audio.removeEventListener("error", handleError);
      };
    }, [audioRef]);
  
    return {
      isPlaying,
      currentTime,
      volume,
      isLoading,
      error,
      togglePlay,
      handleVolumeChange,
      setError
    };
  };

  const useLyrics = (title: string, author: string) => {
    const [lyrics, setLyrics] = useState<LyricLine[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      if (!title || !author) return;
  
      const fetchLyrics = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/lyrics/${title}-${author}.lrc`);
          if (!response.ok) throw new Error("歌词加载失败");
          const data = await response.text();
          const parsedLyrics = parseLRC(data);
          setLyrics(parsedLyrics);
        } catch (err) {
          setError(err instanceof Error ? err.message : "未知错误");
        } finally {
          setIsLoading(false);
        }
      };
  
      fetchLyrics();
    }, [title, author]);
  
    return { lyrics, isLoading, error };
  };

  const usePlaylist = () => {
    const [musicId, setMusicId] = useState(0);
    const [totalMusic, setTotalMusic] = useState(0);
    const [title, setTitle] = useState("春泥棒");
    const [author, setAuthor] = useState("ヨルシカ");
    const [songList, setSongList] = useState<Song[]>([{ title: "春泥棒", author: "ヨルシカ" }]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      const fetchPlaylist = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/json/music.json`);
          if (!response.ok) throw new Error("播放列表加载失败");
          const data = await response.json();
          
          setTitle(data["title"][musicId]);
          setAuthor(data["author"][musicId]);
          setTotalMusic(data["title"].length);
          const songs = data["title"].map((title: string, index: number) => ({
            title,
            author: data["author"][index]
          }));
          setSongList(songs);
        } catch (err) {
          setError(err instanceof Error ? err.message : "未知错误");
        } finally {
          setIsLoading(false);
        }
      };
  
      fetchPlaylist();
    }, [musicId]);
  
    const nextSong = useCallback(() => {
      setMusicId(prevId => (prevId + 1) % totalMusic);
    }, [totalMusic]);
  
    const prevSong = useCallback(() => {
      setMusicId(prevId => (prevId - 1 < 0 ? totalMusic - 1 : prevId - 1));
    }, [totalMusic]);
  
    return {
      musicId,
      title,
      author,
      songList,
      isLoading,
      error,
      nextSong,
      prevSong,
      setMusicId
    };
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const parseLRC = (lrc: string): LyricLine[] => {
    const lines = lrc.split("\n");
    const parsed: LyricLine[] = [];
  
    lines.forEach((line) => {
      const match = line.match(/^\[(\d{2}):(\d{2}(?:\.\d+)?)\](.+)$/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2]);
        const text = match[3].trim();
        parsed.push({ time: minutes * 60 + seconds, text });
      }
    });
  
    return parsed;
  };

  export { formatTime, useAudioPlayer, useLyrics, usePlaylist};