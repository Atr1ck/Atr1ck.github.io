import json
import ffmpeg
import frontmatter
from pathlib import Path
from datetime import date

ARTICLES_FOLDER = Path("public/articles")
PICTURES_FOLDER = Path("public/pictures")
ARTICLES_OUTPUT_FILE = Path("public/json/articles.json")
PICTURES_OUTPUT_FILE = Path("public/json/pictures.json")

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
        
def article_json():
    try:
        ARTICLES_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

        markdown_files = [file for file in ARTICLES_FOLDER.glob("*.md")]
        
        data = {}
        for file_path in markdown_files:
            # 打开文件并加载 frontmatter 数据
            with file_path.open("r", encoding="UTF-8") as file:
                content = frontmatter.load(file)
                metadata = content.metadata
                
                # 转换 date 类型字段为字符串
                if isinstance(metadata.get("date"), (date,)):
                    metadata["date"] = metadata["date"].isoformat()
                
                metadata["content"] = content.content
                data[metadata["title"]] = metadata

        with ARTICLES_OUTPUT_FILE.open("w", encoding="UTF-8") as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=4)


    except Exception as e:
        print(e)

def pictures_json():
    try:
        PICTURES_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

        pictures = [images for images in PICTURES_FOLDER.glob("*")]
        
        data = {}

        for picture in pictures:
            convert_to_webp("public/pictures/" + picture.name , "public/pictures/" + picture.name.split('.')[0] + '.webp')
            tags = ["test"]
            data[picture.name] = tags
        

        with PICTURES_OUTPUT_FILE.open("w", encoding="UTF-8") as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=4)

    except Exception as e:
        print(e)

if __name__ == '__main__':
    article_json()
    pictures_json()
