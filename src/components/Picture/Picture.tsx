import { useState, useEffect } from 'react';
import Loading from '../Load/Load';

type Pictures = Record<string, string[]>;

function getWebpName(imgname: string) {
  return imgname.replace(/\.[^.]+$/, '.webp');
}

function Picturecard({ imgname, tags }: { imgname: string, tags: string[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const handleImageLoad = () => {
    setIsImageLoaded(true);
  };

  return (
    <div
      className={`card mb-4 inline-block w-full break-inside-avoid overflow-hidden border border-base-300 rounded-lg bg-base-100 text-base-content ${
        isModalOpen ? '' : 'hover:shadow-lg hover:-translate-y-1 transition-all duration-300'
      }`}
    >
      <div className="relative">
        <img
          src={`/pictures/${getWebpName(imgname)}`}
          className={`block h-auto w-full cursor-pointer transition-all duration-500 ${isImageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          alt={imgname}
          onClick={toggleModal}
          onLoad={handleImageLoad}
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="flex flex-wrap gap-x-2 px-3 py-2">
        {tags.map((tag, index) => (
          <p
            key={index}
            className="text-sm text-base-content/75 hover:text-primary transition-colors duration-300 cursor-default"
          >
            #{tag}
          </p>
        ))}
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
          onClick={toggleModal}
        >
          <div className="relative max-h-full max-w-5xl bg-base-100 p-4 rounded-lg shadow-2xl">
            <img
              src={`/pictures/${imgname}`}
              alt={imgname}
              className="max-h-[78vh] max-w-full rounded-lg object-contain"
            />
            <a
              href={`/pictures/${imgname}`}
              download={imgname}
              className="btn btn-primary block mt-4 text-center text-white py-2 px-4 rounded-sm"
              onClick={(e) => e.stopPropagation()}
            >
              下载图片
            </a>
            <button
              type="button"
              aria-label="关闭图片预览"
              className="btn btn-circle btn-sm absolute right-2 top-2 z-10 bg-black/60 text-white border-0 hover:bg-black/80"
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
  const [pictures, setPictures] = useState<Pictures | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch('/json/pictures.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load pictures: ${response.status}`);
        return response.json();
      })
      .then((data: Pictures) => setPictures(data))
      .catch(() => setLoadError(true));
  }, []);

  if (loadError) {
    return <div className="p-8 text-center">照片加载失败</div>;
  }

  if (!pictures) {
    return <Loading />;
  }

  return (
    <div className="columns-2 gap-3 px-2 pt-6 md:columns-3 md:gap-4 xl:columns-4">
      {Object.entries(pictures).map(([imgname, tags]) => (
        <Picturecard imgname={imgname} key={imgname} tags={tags} />
      ))}
    </div>
  );
}
