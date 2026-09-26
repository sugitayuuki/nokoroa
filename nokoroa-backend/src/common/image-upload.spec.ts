import {
  ALLOWED_IMAGE_EXTENSIONS,
  InvalidImageUploadError,
  detectImageContentType,
  extractImageExtension,
  hasAllowedImageExtension,
  resolveImageUpload,
} from './image-upload';

/** 各形式の実体を表す最小バイト列 */
const MAGIC = {
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  gif: Buffer.from('GIF89a....', 'binary'),
  webp: Buffer.concat([
    Buffer.from('RIFF', 'binary'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'binary'),
  ]),
};

describe('detectImageContentType', () => {
  it.each([
    ['jpeg', MAGIC.jpeg, 'image/jpeg'],
    ['png', MAGIC.png, 'image/png'],
    ['gif', MAGIC.gif, 'image/gif'],
    ['webp', MAGIC.webp, 'image/webp'],
  ])('%s を先頭バイトから判定する', (_name, buffer, expected) => {
    expect(detectImageContentType(buffer)).toBe(expected);
  });

  it('画像でないものは null', () => {
    expect(detectImageContentType(Buffer.from('<html>hi</html>'))).toBeNull();
    expect(detectImageContentType(Buffer.from('<svg/>'))).toBeNull();
    expect(detectImageContentType(Buffer.alloc(0))).toBeNull();
  });

  it('RIFF だけで WEBP が続かないものは webp と誤認しない', () => {
    const riffWave = Buffer.concat([
      Buffer.from('RIFF', 'binary'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WAVE', 'binary'),
    ]);
    expect(detectImageContentType(riffWave)).toBeNull();
  });
});

describe('拡張子の判定', () => {
  it('大文字の拡張子も許可する (iPhone の写真は .JPG で届く)', () => {
    expect(hasAllowedImageExtension('IMG_0001.JPG')).toBe(true);
    expect(extractImageExtension('IMG_0001.JPG')).toBe('jpg');
  });

  it('svg は許可しない (script を実行できるため)', () => {
    expect(hasAllowedImageExtension('evil.svg')).toBe(false);
  });

  it('二重拡張子は末尾で判定する', () => {
    expect(hasAllowedImageExtension('evil.jpg.html')).toBe(false);
    expect(hasAllowedImageExtension('photo.html.jpg')).toBe(true);
  });

  it('許可リストは jpg/jpeg/png/gif/webp', () => {
    expect(ALLOWED_IMAGE_EXTENSIONS.sort()).toEqual(
      ['gif', 'jpeg', 'jpg', 'png', 'webp'].sort(),
    );
  });
});

describe('resolveImageUpload', () => {
  it('Content-Type はクライアント申告ではなく拡張子から決まる', () => {
    const result = resolveImageUpload({
      originalname: 'photo.JPG',
      buffer: MAGIC.jpeg,
    });
    expect(result).toEqual({ extension: 'jpg', contentType: 'image/jpeg' });
  });

  it('中身が HTML のファイルを .jpg で送っても弾く', () => {
    // S3 の public/ は匿名 GET できるため、text/html として保存されると
    // 自社ドメイン上で任意 JS が実行される。
    expect(() =>
      resolveImageUpload({
        originalname: 'xss.jpg',
        buffer: Buffer.from('<html><script>alert(1)</script></html>'),
      }),
    ).toThrow(InvalidImageUploadError);
  });

  it('中身が SVG のファイルを .png で送っても弾く', () => {
    expect(() =>
      resolveImageUpload({
        originalname: 'xss.png',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      }),
    ).toThrow(InvalidImageUploadError);
  });

  it('拡張子と実体が食い違う場合も弾く (PNG の中身を .jpg で送る)', () => {
    expect(() =>
      resolveImageUpload({ originalname: 'a.jpg', buffer: MAGIC.png }),
    ).toThrow(InvalidImageUploadError);
  });

  it('許可外の拡張子は弾く', () => {
    expect(() =>
      resolveImageUpload({ originalname: 'a.svg', buffer: MAGIC.png }),
    ).toThrow(InvalidImageUploadError);
  });

  it('正しい組み合わせは全形式で通る', () => {
    const cases: Array<[string, Buffer, string]> = [
      ['a.jpg', MAGIC.jpeg, 'image/jpeg'],
      ['a.jpeg', MAGIC.jpeg, 'image/jpeg'],
      ['a.png', MAGIC.png, 'image/png'],
      ['a.gif', MAGIC.gif, 'image/gif'],
      ['a.webp', MAGIC.webp, 'image/webp'],
    ];
    for (const [name, buffer, contentType] of cases) {
      expect(resolveImageUpload({ originalname: name, buffer })).toEqual({
        extension: name.split('.').pop(),
        contentType,
      });
    }
  });
});
