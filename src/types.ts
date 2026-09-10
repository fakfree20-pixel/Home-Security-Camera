export interface ExtractedFile {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  content?: string;
  blobUrl?: string;
  extension: string;
  modifiedTime?: Date;
}

export interface ProjectMetadata {
  fileName: string;
  totalSize: number;
  fileCount: number;
  hasIndexHtml: boolean;
  detectedTech: string[];
  mainEntry?: string;
}
