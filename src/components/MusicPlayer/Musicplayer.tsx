import { PauseCircleOutlined, PlayCircleOutlined, StepBackwardOutlined, StepForwardOutlined, UnorderedListOutlined, SoundOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, useCallback} from "react";
import { Element, scroller } from "react-scroll";
import { LyricLine, Song } from "../../types/musicplayer";
import { useAudioPlayer, useLyrics, usePlaylist, formatTime } from "./musichooks";

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
      (lyric: LyricLine, index: number) =>
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

  const duration = audioRef.current?.duration ?? 0;

  return (
    <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-[100%] md:-translate-x-[95%] hover:translate-x-0 transition-all duration-300 hover:z-50 scale-y-30 hover:scale-y-100">
      <div className="flex flex-col items-center justify-center p-6 bg-base-100/80 text-base-content border border-base-300/70 backdrop-blur-md rounded-lg shadow-md w-full gap-y-8 transition-all duration-300 relative h-3/5">
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
          <p className="font-bold text-xl text-base-content">{title}</p>
          <p className="text-base-content/75">{author}</p>
        </div>

        <div className="flex flex-col overflow-y-hidden h-64" id="lyrics-container">
          {lyrics.map((lyric: LyricLine, index: number) => (
            <Element
              key={index}
              name={`lyric-${index}`}
              className={`p-2 ${
                index === activeLyricIndex 
                  ? "text-base-content font-bold text-xl duration-75 transition-all text-center"
                  : "text-base-content/60 duration-75 transition-all text-center"
              }`}
            >
              {lyric.text}
            </Element>
          ))}
        </div>

        <div className="flex w-full text-sm text-base-content justify-center items-center">
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
          className={`absolute top-0 right-0 w-full h-full bg-base-100 text-base-content p-4 overflow-y-auto transition-all duration-300 origin-right rounded-lg ${
            listShow ? "opacity-100" : "scale-x-0 opacity-0"
          }`}
        >
          <h2 className="text-xl font-bold mb-4">歌曲列表</h2>
          <ul>
            {songList.map((song: Song, index: number)=> (
              <li
                key={index}
                className={`p-2 rounded cursor-pointer ${
                  index === musicId ? "bg-base-300" : "hover:bg-base-200"
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
