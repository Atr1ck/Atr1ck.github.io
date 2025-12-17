export default function Test() {
    return (
        <div className="flex items-center justify-center h-full w-full gap-x-3">
            <div className="loading loading-spinner"></div>
            <div className="text-6xl font-bold text-white relative 
                transition-transform hover:translate-y-[-3px]
                [text-shadow:_4px_4px_0_#000000]">
            Loading...
            </div>
        </div>
    )
}