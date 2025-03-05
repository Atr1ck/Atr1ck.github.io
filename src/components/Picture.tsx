import { useState, useEffect } from 'react';

function Picturecard({ imgname, tags }: { imgname: string, tags: string[] }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const toggleModal = () => setIsModalOpen(!isModalOpen);

    return (
        <div className={`flex flex-col w-full h-auto border border-gray-600 rounded-lg bg-gray-950 ${isModalOpen ? "" : "hover:shadow-lg hover:scale-105 transition-all duration-300"}`}>

            <img
                src={`/pictures/${imgname.split('.')[0] + '.webp'}`}
                className="rounded-t-lg cursor-pointer"
                alt={imgname}
                onClick={toggleModal}
            />
            <div className="flex">
            {tags.map((tag, index) => (
                <p key={index} className="text-white my-2 ml-2 hover:text-blue-400 transition-all duration-300 cursor-default">
                    #{tag}
                </p>
            ))}
            </div>

            {isModalOpen && (
                <div
                    className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-80 z-40"
                    onClick={toggleModal}
                >
                    <div className="relative bg-gray-800 p-4 rounded-lg">
                        <img
                            src={`/pictures/${imgname}`}
                            alt={imgname}
                            className="max-w-full max-h-[80vh] rounded-lg"
                        />
                        <a
                            href={`/pictures/${imgname}`}
                            download={imgname}
                            className="block mt-4 text-center bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                            onClick={(e) => e.stopPropagation()}
                        >
                            下载图片
                        </a>
                        <button
                            className="absolute top-2 right-2 text-white text-2xl z-50"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleModal();
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


export default function Imageshow() {
    const [pictures, setPictures] = useState({});
    let part1;
    let part2;
    let part3;
    useEffect(() => {
        fetch('/json/pictures.json')
            .then((res) => res.json())
            .then((data) => {
                setPictures(data);
        })
    }, []);

    if (pictures) {
        const entries = Object.entries(pictures);

        // 确定每部分的大小
        const chunkSize = Math.ceil(entries.length / 3);

        // 分割为三部分
        part1 = Object.fromEntries(entries.slice(0, chunkSize));
        part2 = Object.fromEntries(entries.slice(chunkSize, chunkSize * 2));
        part3 = Object.fromEntries(entries.slice(chunkSize * 2));
    }

    return (
        <div className="grid grid-cols-3 gap-4 items-start mt-6 w-3/4 ml-8">
            <div className='space-y-4'>
            {Object.entries(part1 || {}).map(([imgname, tags], index) => {
                return (
                <Picturecard imgname={imgname} key={index} tags={tags as string[]}></Picturecard>
                )
            })}
            </div>
            <div className='space-y-4'>
            {Object.entries(part2 || {}).map(([imgname, tags], index) => {
                return (
                <Picturecard imgname={imgname} key={index} tags={tags as string[]}></Picturecard>
                )
            })}
            </div>
            <div className='space-y-4'>
            {Object.entries(part3 || {}).map(([imgname, tags], index) => {
                return (
                <Picturecard imgname={imgname} key={index} tags={tags as string[]}></Picturecard>
                )
            })}
            </div>
        </div>
    );
}