export interface CategoryDefinition {
  slug: string;
  name: string;
  order: number;
}

export interface CategoryConfig {
  version: 1;
  articles: CategoryDefinition[];
  pictures: CategoryDefinition[];
}

export interface PictureItem {
  id: string;
  title: string;
  file: string;
  preview: string;
  category: string;
  tags: string[];
  date: string;
  published: boolean;
}

export interface PictureIndex {
  version: 1;
  pictures: PictureItem[];
}
