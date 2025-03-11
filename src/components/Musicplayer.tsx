import { PauseCircleOutlined, PlayCircleOutlined, StepBackwardOutlined, StepForwardOutlined, UnorderedListOutlined } from "@ant-design/icons";
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
  const [musicId, setMusicId] = useState(0);
  const [totalMusic, setTotalMusic] = useState(0);
  const [title, setTitle] = useState("春泥棒");
  const [author, setAuthor] = useState("ヨルシカ");
  const [songList, setSongList] = useState([{"title": "春泥棒", "author": "ヨルシカ"}]);
  const [listShow, setListShow] = useState(false);

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
    fetch(`/json/music.json`)
      .then((res) => res.json())
      .then((data) => {
        setTitle(data["title"][musicId]);
        setAuthor(data["author"][musicId]);
        setTotalMusic(data["title"].length);
        const songs = data["title"].map((title: string, index: number) => ({
          "title": title,
          "author": data["author"][index]
        }));

        setSongList(songs);
        }
      );
  }, [musicId]);

  useEffect(() => {
    if (title && author) {
      fetch(`/lyrics/${title}-${author}.lrc`)
      .then((res) => res.text())
      .then((data) => {
        const parsedLyrics = parseLRC(data);
        setLyrics(parsedLyrics);
      })
    }
  },[title, author])
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

    // 确保找到有效的歌词索引
    if (activeLyric !== -1) {
      setActiveLyricIndex(activeLyric);

      // 使用 react-scroll 滚动到对应歌词位置
      scroller.scrollTo(`lyric-${activeLyric}`, {
        duration: 300,
        smooth: true,
        offset: -75, // 调整位置偏移
        containerId: "lyrics-container",
      });
    }
  }, [currentTime, lyrics]);

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (audio) {
      const value = Number(event.target.value);
      audio.currentTime = value; // 跳转到新的时间
    }
  };

  const handleEnded = () => {
    setMusicId((prevId) => (prevId + 1) % totalMusic); // 使用函数式更新避免异步问题
    togglePlay();
  };

  
  return (
    <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-[95%] hover:translate-x-0 transition-all duration-300 hover:z-50 scale-y-30 hover:scale-y-100">
      <div className={`flex flex-col items-center justify-center p-6 bg-gray-100/40 hover:bg-base-300/80 hover:md:bg-gray-100/40 rounded-2xl shadow-md w-full gap-y-8 transition-all duration-300 relative h-3/5`}>
        <audio ref={audioRef} src={`/music/${title}-${author}.mp3`} preload="metadata" onEnded={handleEnded}/>
        
        <div className={`flex items-center transition-all duration-300 flex-col gap-y-1`}>
          <p className="font-bold text-xl text-white">{title}</p>
          <p className=" text-white">{author}</p>
        </div>

        <div className="flex flex-col overflow-y-hidden h-64 " id="lyrics-container">
        {lyrics.map((lyric, index) => (
          <Element
            key={index}
            name={`lyric-${index}`}
            className={`p-2 ${
              index === activeLyricIndex ? "text-white font-bold text-xl duration-75 transition-all text-center" : "text-gray-200 duration-75 transition-all text-center"
            }`}
          >
            {lyric.text}
          </Element>
        ))}
      </div>

        <div className={`flex w-full text-sm text-white justify-center`}>
          <div className="font-bold text-lg">
            {String(Math.floor(currentTime / 60)).padStart(2, "0")}:
            {String(Math.floor(currentTime) - Math.floor(currentTime / 60) * 60).padStart(2, "0")}
          </div>
          <input type="range" value={currentTime} min="0" max={audioRef.current?.duration || 0} step="0.1" onChange={handleProgressChange} className={`mx-2 transition-all duration-300 w-3/5`}/>
          <div className="font-bold text-lg">
            {String(Math.floor(audioRef.current?.duration as number / 60 || 0)).padStart(2, "0")}:
            {String(Math.floor(audioRef.current?.duration as number) - Math.floor(audioRef.current?.duration as number / 60) * 60 || 0).padStart(2, "0")}
          </div>
        </div>

        <div className={`flex gap-x-1`}>
        <StepBackwardOutlined className={`transition-all duration-300 text-4xl`} onClick={() => { 
          setMusicId((prevId) => prevId - 1 < 0 ? totalMusic - 1 : prevId - 1);
          setIsPlaying(false);
          }}/>
        {isPlaying ? <PauseCircleOutlined className={`transition-all duration-300 text-4xl`} onClick={togglePlay}/> : 
        <PlayCircleOutlined className={`transition-all duration-300 text-4xl`} onClick={togglePlay}/>}
        <StepForwardOutlined className={`transition-all duration-300 text-4xl`} onClick={() => {
          setMusicId((prevId) => (prevId + 1) % totalMusic);
          setIsPlaying(false);
          }}/>
        </div>

        <UnorderedListOutlined className="text-xl absolute top-2 right-5 z-10" onClick={() => setListShow(!listShow)}/>
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
                setIsPlaying(false); // 停止当前播放
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