import json
import frontmatter
from pathlib import Path
from datetime import date

ARTICLES_FOLDER = Path("public/articles")
OUTPUT_FILE = Path("public/json/articles.json")

def list_articles():
    try:
        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

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

        with OUTPUT_FILE.open("w", encoding="UTF-8") as output_file:
            json.dump(data, output_file, ensure_ascii=False, indent=4)

        

    except Exception as e:
        print(e)

if __name__ == '__main__':
    list_articles()
