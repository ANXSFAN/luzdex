/**
 * 上传校验规则：/api/upload（小文件经服务器）与 /api/upload/presign（大文件
 * 浏览器直传 R2）共用同一套白名单，防止直传通道绕过安全校验。
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB 上限（主要管文档直传），挡住误传超大文件刷爆存储

// 图片专属上限：4MB。图片走 /api/upload（经 Vercel 函数，请求体硬上限 ~4.5MB），
// 设 4MB 留余量并给友好提示；服务端会用 sharp 转 WebP 大幅压缩，原图不必传太大。
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// 公开 R2 桶上的存储型 XSS / 可执行内容向量：一律拒绝。
// SVG/HTML 可内嵌脚本，挂在我们域名下会变成 XSS；脚本/可执行文件则是免费恶意托管。
export const BLOCKED_TYPES = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "application/x-msdownload",
  "application/x-httpd-php",
]);
export const BLOCKED_EXT = new Set([
  "svg", "html", "htm", "xhtml", "js", "mjs", "php", "exe", "sh", "bat", "cmd",
]);

/** 从文件名取安全扩展名（非字母数字一律回退 bin）。 */
export function safeExt(fileName: string): string {
  const raw = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  return /^[a-z0-9]+$/i.test(raw) ? raw.toLowerCase() : "bin";
}
