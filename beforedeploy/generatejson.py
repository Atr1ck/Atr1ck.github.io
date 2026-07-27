import json
import ffmpeg
from pathlib import Path

PICTURES_FOLDER = Path("public/pictures")
MUSICS_FOLDER = Path("public/music")
PICTURES_OUTPUT_FILE = Path("public/json/pictures.json")
MUSICS_OUTPUT_FILE = Path("public/json/music.json")



def convert_to_webp(input_image_path: str, output_image_path: str, quality: int = 75):
    """
    将图片转换为 WebP 格式。
    
    :param input_image_path: 输入图片路径
    :param output_image_path: 输出 WebP 图片路径
    :param quality: WebP 图片质量 (0-100)
    """
    if Path(output_image_path).exists() :
        print(f"文件已存在，跳过转换: {output_image_path}")
        return

    try:
        # 使用 ffmpeg 进行图片转换
        ffmpeg.input(input_image_path).output(output_image_path, q=quality).run(overwrite_output=True)
        print(f"转换成功: {output_image_path}")
    except ffmpeg.Error as e:
        print(f"转换失败: {e.stderr.decode('utf-8')}")
        
def pictures_json():
    try:
        PICTURES_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

        pictures = [
            image for image in PICTURES_FOLDER.glob("*")
            if image.suffix.lower() not in {".webp"}
        ]
        
        data = {}

        for picture in pictures:
            convert_to_webp("public/pictures/" + picture.name , "public/pictures/" + picture.stem + '.webp', quality=5)
            tags = picture.stem.split()[1:]
            data[picture.name] = tags
        

        with PICTURES_OUTPUT_FILE.open("w", encoding="UTF-8") as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=4)

    except Exception as e:
        print(e)
        
def music_json():
    try:
        MUSICS_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

        musics = [music for music in MUSICS_FOLDER.glob("*")]
        
        data = {"title":[], "author":[]}

        for music in musics:
            music_info = music.stem.split("-")
            data["title"].append(music_info[0])
            data["author"].append(music_info[1])

        with MUSICS_OUTPUT_FILE.open("w", encoding="UTF-8") as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=4)

    except Exception as e:
        print(e)

if __name__ == '__main__':
    pictures_json()
    music_json()
