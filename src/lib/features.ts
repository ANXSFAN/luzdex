/**
 * Site-wide feature flags.
 *
 * v1 定位为纯展示资料站：询价入口整体隐藏，只保留浏览 + 流量统计。
 * 想重新开放询价时，把 INQUIRY_ENABLED 改为 true 即可（前台入口会回来，
 * InquiryClick 统计与 deep link 代码一直保留，无需其它改动）。
 */
export const INQUIRY_ENABLED = false;
