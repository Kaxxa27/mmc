import { detectImageType } from './media.service.js';

describe('detectImageType', () => {
  it('recognises PNG, JPEG and WebP by their bytes', () => {
    expect(
      detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.type,
    ).toBe('image/png');
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.type).toBe('image/jpeg');
    expect(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary'))?.type).toBe('image/webp');
  });

  it('rejects anything else, whatever the declared type', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
  });
});
