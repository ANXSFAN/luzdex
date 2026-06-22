"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LuzdexMark } from "@/components/luzdex-mark";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setError("用户名或密码错误");
      setLoading(false);
    } else {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-surface-sunken)] px-6">
      <div className="w-full max-w-sm rounded-3xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:p-10">
        <div className="flex items-center gap-2.5">
          <LuzdexMark size={22} />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)]">
            Luzdex Admin
          </p>
        </div>
        <h1 className="headline-lg mt-3 text-[26px] text-[var(--color-ink)]">
          Luzdex 后台
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="用户名" name="username" type="text" />
          <Field label="密码" name="password" type="password" />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="appbtn w-full disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            登录
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, name, type }: { label: string; name: string; type: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-xs text-[var(--color-ink-muted)]">
        {label}
      </label>
      <input id={name} name={name} type={type} required className="form-input" />
    </div>
  );
}
