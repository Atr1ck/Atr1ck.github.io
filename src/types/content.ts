export interface PictureItem {
  id: string;
  title: string;
  file: string;
  preview: string;
  tags: string[];
  date: string;
  published: boolean;
}

export interface PictureIndex {
  version: 1;
  pictures: PictureItem[];
}
