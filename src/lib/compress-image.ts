export async function compressImage(file: File, maxSize = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas tidak didukung")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const isPng = file.type === "image/png";
      resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal membaca gambar")); };
    img.src = url;
  });
}
