export function titleCaseTag(value: string) {
  return value.trim().split(/\s+/).map((word) => {
    if (!word || /[\u4e00-\u9fff]/.test(word) || (word.length > 1 && word === word.toUpperCase())) return word;
    return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
  }).join(" ");
}

export function normalizeTagList(tags: string[]) {
  const normalized = tags.map(titleCaseTag).filter(Boolean);
  return normalized.filter((tag, index) => normalized.findIndex((item) => item.toLocaleLowerCase("zh-CN") === tag.toLocaleLowerCase("zh-CN")) === index);
}
