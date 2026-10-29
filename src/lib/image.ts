/** Tipos aceitos para avatar (os mesmos do contrato). */
export const AVATAR_ACCEPT = ["image/png", "image/jpeg", "image/webp"] as const;
/** Limite do arquivo original; depois do redimensionamento o resultado fica bem abaixo dos 512 KB da API. */
export const AVATAR_SOURCE_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;

export class AvatarError extends Error {}

/**
 * Lê a imagem escolhida, recorta ao centro em quadrado e reduz para 256 px (WebP).
 * Mantém o data URL pequeno: o mock persiste o avatar no localStorage.
 */
export async function fileToAvatarDataUrl(file: File) {
  if (!(AVATAR_ACCEPT as readonly string[]).includes(file.type)) {
    throw new AvatarError("Envie uma imagem PNG, JPG ou WEBP.");
  }
  if (file.size > AVATAR_SOURCE_MAX_BYTES) {
    throw new AvatarError("Use uma imagem de até 5 MB.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError("Não foi possível ler esta imagem. Tente outro arquivo.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new AvatarError("Seu navegador não conseguiu processar a imagem.");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.85);
}
