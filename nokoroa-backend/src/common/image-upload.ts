/**
 * 画像アップロードの検証。
 *
 * S3 の public/ 配下は匿名で GET できる (terraform/modules/s3 のバケット
 * ポリシー) ため、アップロード時に決まる Content-Type がそのまま閲覧者の
 * ブラウザへ届く。file.mimetype は multipart のパートヘッダ由来でクライアント
 * が自由に設定できるので、これを信用すると text/html や image/svg+xml を
 * 宣言されて自社ドメイン上で任意 JS が実行される。
 *
 * 対策は 2 つ:
 *   1. Content-Type は拡張子から許可リストで導出する (クライアント値は捨てる)
 *   2. 先頭バイトで実体を検証し、拡張子だけ画像に偽装したファイルを弾く
 */

/** 許可する拡張子 -> 配信時の Content-Type。svg は script を実行できるため含めない。 */
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export const ALLOWED_IMAGE_EXTENSIONS = Object.keys(EXTENSION_CONTENT_TYPES);

/** 拡張子の大小は問わない (iPhone の写真は .JPG で届く)。 */
const ALLOWED_EXTENSION_PATTERN = new RegExp(
  `\\.(${ALLOWED_IMAGE_EXTENSIONS.join('|')})$`,
  'i',
);

export function hasAllowedImageExtension(originalname: string): boolean {
  return ALLOWED_EXTENSION_PATTERN.test(originalname);
}

/** originalname から正規化した拡張子を取り出す。許可外なら null。 */
export function extractImageExtension(originalname: string): string | null {
  const match = ALLOWED_EXTENSION_PATTERN.exec(originalname);
  return match ? match[1].toLowerCase() : null;
}

function startsWith(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, i) => buffer[offset + i] === byte);
}

/** 先頭バイトから実体の種別を判定する。判定できなければ null。 */
export function detectImageContentType(buffer: Buffer): string | null {
  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // GIF: "GIF87a" / "GIF89a"
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  // WebP: "RIFF" ....(4 byte size).... "WEBP"
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}

export class InvalidImageUploadError extends Error {}

/**
 * 保存に使う拡張子と Content-Type を確定する。
 * 拡張子が許可外、または中身が拡張子と一致しない場合は例外を投げる。
 */
export function resolveImageUpload(file: {
  originalname: string;
  buffer: Buffer;
}): { extension: string; contentType: string } {
  const extension = extractImageExtension(file.originalname);
  if (!extension) {
    throw new InvalidImageUploadError(
      `対応していない画像形式です (${ALLOWED_IMAGE_EXTENSIONS.join(', ')})`,
    );
  }

  const contentType = EXTENSION_CONTENT_TYPES[extension];
  const detected = detectImageContentType(file.buffer);
  if (detected !== contentType) {
    // 拡張子だけ画像に偽装したファイル。中身が HTML だと公開 URL 上で
    // スクリプトが動きうるため、ここで確実に落とす。
    throw new InvalidImageUploadError('ファイルの内容が拡張子と一致しません');
  }

  return { extension, contentType };
}
