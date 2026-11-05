export async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 20_000_000) throw new Error('20MB 이하의 사진을 선택해 주세요.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('이 사진을 읽을 수 없어요. JPG·PNG·WebP 사진으로 다시 선택해 주세요.'); });
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let src = canvas.toDataURL('image/jpeg', .78);
    if (src.length > 350000) src = canvas.toDataURL('image/jpeg', .45);
    if (src.length > 350000) throw new Error('사진이 너무 복잡해요. 작은 사진으로 다시 선택해 주세요.');
    return src;
  } finally { bitmap.close(); }
}
