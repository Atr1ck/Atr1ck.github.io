import { useEffect, useRef, useState } from "react";
import { Element, scroller } from "react-scroll";

type LyricLine = {
  time: number;
  text: string;
}

export default function MusicPlayer(){
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeLyricIndex, setActiveLyricIndex] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 加载歌词
  useEffect(() => {
    fetch('/lyrics/太陽-ヨルシカ.lrc')
      .then((res) => res.text())
      .then((data) => {
        const parsedLyrics = parseLRC(data);
        setLyrics(parsedLyrics);
      });
  }, []);

  // 更新当前时间
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.addEventListener("timeupdate", updateTime);
    return () => audio.removeEventListener("timeupdate", updateTime);
  }, []);

  useEffect(() => {
    const activeLyric = lyrics.findIndex(
      (lyric, index) =>
        currentTime >= lyric.time &&
        (index === lyrics.length - 1 || currentTime < lyrics[index + 1].time)
    );

    console.log("Active Lyric:", activeLyric, "Current Time:", currentTime);
    // 确保找到有效的歌词索引
    if (activeLyric !== -1) {
      setActiveLyricIndex(activeLyric);

      // 使用 react-scroll 滚动到对应歌词位置
      scroller.scrollTo(`lyric-${activeLyric}`, {
        duration: 500,
        smooth: true,
        offset: -100, // 调整位置偏移
        containerId: "lyrics-container",
      });
    }
  }, [currentTime, lyrics]);

  return (
    <div className="flex-grow flex justify-center mt-6 relative">
      <div className="absolute bg-cover blur-sm -z-10 bg-[url('/images/yorushika.png')] bg-center w-2/3 h-2/3"></div>
      <div className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg shadow-md w-2/3 h-2/3 gap-y-8 bg-opacity-40">
        <audio ref={audioRef} src="/music/太陽-ヨルシカ.mp3" preload="metadata" />
        <div className="flex flex-col overflow-y-hidden h-64 " id="lyrics-container">
          {lyrics.map((lyric, index) => (
            <Element
              key={index}
              name={`lyric-${index}`}
              className={`p-2 ${
                index === activeLyricIndex ? "text-red-400 font-bold text-xl duration-75 transition-all text-center" : "text-gray-500 duration-75 transition-all text-center"
              }`}
            >
              {lyric.text}
            </Element>
          ))}
        </div>
        <div className="flex justify-between w-3/5 text-sm text-gray-600">
          <span className="font-bold text-lg">
            {String(Math.floor(currentTime / 60)).padStart(2, "0")}:
            {String(Math.floor(currentTime) - Math.floor(currentTime / 60) * 60).padStart(2, "0")}
          </span>
          <span className="font-bold text-lg">
            {String(Math.floor(audioRef.current?.duration as number / 60 || 0)).padStart(2, "0")}:
            {String(Math.floor(audioRef.current?.duration as number) - Math.floor(audioRef.current?.duration as number / 60) * 60 || 0).padStart(2, "0")}
          </span>
        </div>
        <button
          onClick={togglePlay}
          className="px-4 py-2 mb-4 text-white bg-gray-400 rounded hover:bg-gray-500"
        >
          {isPlaying ? "暂停" : "播放"}
        </button>

      </div>
      </div>
  );
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