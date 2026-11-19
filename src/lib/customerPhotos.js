import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

export async function persistCustomerPhoto(uri) {
  const directory = new Directory(Paths.document, "customer-photos");
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${Crypto.randomUUID()}.jpg`);
  await new File(uri).copy(destination);
  return destination.uri;
}

export async function deleteCustomerPhoto(uri) {
  const photo = new File(uri);
  if (photo.exists) await photo.delete();
}
