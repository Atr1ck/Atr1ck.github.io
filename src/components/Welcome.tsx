// components/WelcomeOverlay.jsx
import { useSpring, animated } from '@react-spring/web'
import { useState, useEffect } from 'react'

export default function WelcomeOverlay() {
  const [showWelcome, setShowWelcome] = useState(true)

  // 定义欢迎界面动画
  const [welcomeStyles, welcomeApi] = useSpring(() => ({
    from: { opacity: 1 },
    config: { tension: 120, friction: 20 } // 弹簧动画参数
  }))

  const [progressStyles] = useSpring(() => ({
    from: { width: '0%' },
    to: { width: '100%' },
    config: { duration: 2000 }
  }))

  

  useEffect(() => {
    const timer = setTimeout(() => {
      welcomeApi.start({
        opacity: 0,
        onRest: () => setShowWelcome(false) // 动画完成后隐藏组件
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  if (!showWelcome) return null

  return (
    <animated.div
      style={welcomeStyles}
      className="fixed inset-0 z-20 flex items-center justify-center bg-cover bg-[url('/images/welcome-bg-mobile-com.webp')] md:bg-[url('/images/welcome-bg-com.webp')]"
    >
    <div className='bg-black/50 w-full h-full absolute blur-sm'></div>
      <animated.div
        className="text-3xl font-bold text-white flex flex-col items-center gap-y-4 relative"
        style={{
          transform: welcomeStyles.opacity.to(v => `scale(${1 + (1 - v) * 0.5})`)
        }}
      >
        <p>Welcome</p>
        <p>To</p>
        <Typewriter text="Atr1ck's Blog" speed={135}></Typewriter>
      </animated.div>
      <animated.div
        className="absolute top-0 h-1 bg-blue-500"
        style={progressStyles}
        />
    </animated.div>
  )
}

export function Typewriter({ text = "", speed = 100 }) {
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