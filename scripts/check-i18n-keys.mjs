// 扫描 src 下所有 useTranslations/getTranslations 用法，检查字面量 key 是否在 9 个语言文件齐全。
// 用法：node scripts/check-i18n-keys.mjs
import fs from "node:fs";
import path from "node:path";

const SRC = "src";
const MESSAGES_DIR = "messages";

const locales = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json"));
const dicts = Object.fromEntries(
  locales.map((f) => [f, JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, f), "utf8"))])
);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "generated" || e.name === "node_modules") continue;
      yield* walk(p);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) yield p;
  }
}

function resolve(obj, key) {
  return key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}

const used = new Map(); // fullKey -> [file:line]
const dynamic = []; // 动态 key，需人工看

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, "utf8");
  // 声明：const t = useTranslations("ns") / useTranslations() / await getTranslations(...)
  const decls = [];
  const dre =
    /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:use|get)Translations\(\s*(?:"([^"]*)"|\{[^)]*?namespace:\s*"([^"]*)"[^)]*?\})?\s*\)/g;
  let m;
  while ((m = dre.exec(text)))
    decls.push({ name: m[1], ns: m[2] ?? m[3] ?? "", index: m.index });
  if (!decls.length) continue;

  // 同名翻译函数可能在一个文件的多个组件里以不同 namespace 声明（如两个组件都叫 tp），
  // 调用按「就近的前一个同名声明」归属，避免交叉误报。
  const names = [...new Set(decls.map((d) => d.name))];
  for (const name of names) {
    const myDecls = decls.filter((d) => d.name === name);
    const callRe = new RegExp(`(?<![\\w.])${name}(?:\\.(?:rich|raw|markup|has))?\\(\\s*("([^"]+)"|\`[^\`]*\`)`, "g");
    let c;
    while ((c = callRe.exec(text))) {
      const before = myDecls.filter((d) => d.index < c.index);
      const ns = (before.length ? before[before.length - 1] : myDecls[0]).ns;
      const line = text.slice(0, c.index).split("\n").length;
      if (c[1].startsWith("`")) {
        if (c[1].includes("${")) dynamic.push(`${file}:${line}  ${name}(${c[1]})  [ns=${ns}]`);
        else {
          const key = (ns ? ns + "." : "") + c[1].slice(1, -1);
          (used.get(key) ?? used.set(key, []).get(key)).push(`${file}:${line}`);
        }
        continue;
      }
      const key = (ns ? ns + "." : "") + c[2];
      (used.get(key) ?? used.set(key, []).get(key)).push(`${file}:${line}`);
    }
  }
}

let bad = 0;
for (const [key, sites] of [...used.entries()].sort()) {
  const missing = locales.filter((f) => {
    const v = resolve(dicts[f], key);
    return v === undefined || typeof v === "object";
  });
  if (missing.length) {
    bad++;
    console.log(`MISSING ${key}`);
    console.log(`  locales: ${missing.join(", ")}`);
    console.log(`  used at: ${sites[0]}${sites.length > 1 ? ` (+${sites.length - 1})` : ""}`);
  }
}
console.log(`\n${used.size} literal keys checked, ${bad} missing.`);
if (dynamic.length) {
  console.log(`\nDynamic keys (check manually):`);
  for (const d of dynamic) console.log("  " + d);
}
