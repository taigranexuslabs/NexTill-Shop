import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

function getProductImageDirectory() {
  const directory = new Directory(Paths.document, "product-images");
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

export async function persistProductPhoto(uri) {
  const destination = new File(getProductImageDirectory(), `${Crypto.randomUUID()}.jpg`);
  await new File(uri).copy(destination);
  return destination.uri;
}

export async function cacheCloudProductImage(productId, imageUrl) {
  const destination = new File(getProductImageDirectory(), `${productId}.jpg`);
  await File.downloadFileAsync(imageUrl, destination, { idempotent: true });
  return destination.uri;
}
