import { PauseCircleOutlined, PlayCircleOutlined, StepBackwardOutlined, StepForwardOutlined, UnorderedListOutlined, SoundOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Element, scroller } from "react-scroll";

type LyricLine = {
  time: number;
  text: string;
}

type Song = {
  title: string;
  author: string;
}

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

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [listShow, setListShow] = useState(false);
  const [activeLyricIndex, setActiveLyricIndex] = useState(0);

  const {
    isPlaying,
    currentTime,
    volume,
    isLoading: isAudioLoading,
    error: audioError,
    togglePlay,
    handleVolumeChange
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
    setMusicId
  } = usePlaylist();

  const { lyrics, isLoading: isLyricsLoading, error: lyricsError } = useLyrics(title, author);

  const handleProgressChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (audio) {
      const value = Number(event.target.value);
      audio.currentTime = value;
    }
  }, []);

  const handleEnded = useCallback(() => {
    nextSong();
    togglePlay();
  }, [nextSong, togglePlay]);

  useEffect(() => {
    const activeLyric = lyrics.findIndex(
      (lyric, index) =>
        currentTime >= lyric.time &&
        (index === lyrics.length - 1 || currentTime < lyrics[index + 1].time)
    );

    if (activeLyric !== -1) {
      setActiveLyricIndex(activeLyric);
      scroller.scrollTo(`lyric-${activeLyric}`, {
        duration: 300,
        smooth: true,
        offset: -75,
        containerId: "lyrics-container",
      });
    }
  }, [currentTime, lyrics]);

  const isLoading = isAudioLoading || isPlaylistLoading || isLyricsLoading;
  const error = audioError || playlistError || lyricsError;

  const duration = useMemo(() => audioRef.current?.duration || 0, [audioRef.current?.duration]);

  return (
    <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-[100%] md:-translate-x-[95%] hover:translate-x-0 transition-all duration-300 hover:z-50 scale-y-30 hover:scale-y-100">
      <div className={`flex flex-col items-center justify-center p-6 bg-gray-100/40 hover:bg-gray-100/40 rounded-2xl shadow-md w-full gap-y-8 transition-all duration-300 relative h-3/5`}>
        <audio 
          ref={audioRef} 
          src={`/music/${title}-${author}.mp3`} 
          preload="metadata" 
          onEnded={handleEnded}
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
            <div className="text-white">加载中...</div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-500/50 rounded-2xl">
            <div className="text-white">{error}</div>
          </div>
        )}

        <div className={`flex items-center transition-all duration-300 flex-col gap-y-1`}>
          <p className="font-bold text-xl text-white">{title}</p>
          <p className="text-white">{author}</p>
        </div>

        <div className="flex flex-col overflow-y-hidden h-64" id="lyrics-container">
          {lyrics.map((lyric, index) => (
            <Element
              key={index}
              name={`lyric-${index}`}
              className={`p-2 ${
                index === activeLyricIndex 
                  ? "text-white font-bold text-xl duration-75 transition-all text-center" 
                  : "text-gray-200 duration-75 transition-all text-center"
              }`}
            >
              {lyric.text}
            </Element>
          ))}
        </div>

        <div className="flex w-full text-sm text-white justify-center items-center">
          <div className="font-bold text-lg">{formatTime(currentTime)}</div>
          <input 
            type="range" 
            value={currentTime} 
            min="0" 
            max={duration} 
            step="0.1" 
            onChange={handleProgressChange} 
            className="mx-2 transition-all duration-300 w-3/5"
          />
          <div className="font-bold text-lg">{formatTime(duration)}</div>
        </div>

        <div className="flex items-center gap-x-4">
          <div className="flex gap-x-1">
            <StepBackwardOutlined 
              className="transition-all duration-300 text-4xl cursor-pointer" 
              onClick={prevSong}
            />
            {isPlaying ? (
              <PauseCircleOutlined 
                className="transition-all duration-300 text-4xl cursor-pointer" 
                onClick={togglePlay}
              />
            ) : (
              <PlayCircleOutlined 
                className="transition-all duration-300 text-4xl cursor-pointer" 
                onClick={togglePlay}
              />
            )}
            <StepForwardOutlined 
              className="transition-all duration-300 text-4xl cursor-pointer" 
              onClick={nextSong}
            />
          </div>
          <div className="flex items-center gap-x-2">
            <SoundOutlined className="text-xl" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20"
            />
          </div>
        </div>

        <UnorderedListOutlined 
          className="text-xl absolute top-2 right-5 z-10 cursor-pointer" 
          onClick={() => setListShow(!listShow)}
        />
        
        <div
          className={`absolute top-0 right-0 w-full h-full bg-gray-800 text-white p-4 overflow-y-auto transition-all duration-300 origin-right rounded-md ${
            listShow ? "opacity-100" : "scale-x-0 opacity-0"
          }`}
        >
          <h2 className="text-xl font-bold mb-4">歌曲列表</h2>
          <ul>
            {songList.map((song, index) => (
              <li
                key={index}
                className={`p-2 rounded cursor-pointer ${
                  index === musicId ? "bg-gray-700" : "hover:bg-gray-600"
                }`}
                onClick={() => {
                  setMusicId(index);
                  togglePlay();
                }}
              >
                {song.title} - {song.author}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

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