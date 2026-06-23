import { redirect } from "next/navigation";

// 资料站不设公开主页：流量靠扫码直达 /p/{slug}。访问根路径直接送进后台，
// 未登录会被 middleware 拦到 /login，已登录则落到后台首页。
export default function Home() {
  redirect("/admin");
}
