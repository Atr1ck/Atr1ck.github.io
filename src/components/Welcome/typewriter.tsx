import { useSpring, animated } from "@react-spring/web";
import { useState, useEffect } from "react";

function Typewriter({ text = "", speed = 100 }) {
    const [visibleChars, setVisibleChars] = useState(0)
  
    // 定义文字动画
    const { width } = useSpring({
      from: { width: '0%' },
      to: { width: `${(visibleChars / text.length) * 100}%` },
      config: { duration: speed * text.length }
    })
  
    useEffect(() => {
      // 逐字显示
      if (visibleChars < text.length) {
        const timer = setTimeout(() => {
          setVisibleChars(prev => prev + 1)
        }, speed)
  
        return () => clearTimeout(timer)
      }
    }, [visibleChars, text.length, speed])
  
    return (
      <div className="relative inline-block">
        <animated.div
          style={{ width }}
          className="absolute top-0 left-0 h-full z-30"
        />
        <span className="text-4xl font-mono text-blue-300/95">
          {text.slice(0, visibleChars)}
        </span>
      </div>
    )
  }

export { Typewriter };