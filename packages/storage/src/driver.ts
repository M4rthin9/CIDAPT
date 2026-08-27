export interface StorageFile {
  key: string;
  contentType: string;
  size: number;
  lastModified: number;
}

export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<StorageFile>;
  get(key: string): Promise<Buffer | null>;
  head(key: string): Promise<StorageFile | null>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
