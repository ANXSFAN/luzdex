import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
  Font,
} from "@react-pdf/renderer";
import type { ProductSpec } from "@/lib/products";
import {
  interRegular,
  interMedium,
  interSemiBold,
  jetBrainsMonoMedium,
} from "@/lib/pdf-fonts";

/**
 * Inter for body/sans, JetBrains Mono for tabular numerics & codes.
 * 字体以 base64 内置(见 pdf-fonts.ts)——之前实时拉 fonts.gstatic.com,
 * Google 下架带版本号的 ttf 后渲染整体 500。内置后不依赖外网。
 */
Font.register({
  family: "Inter",
  fonts: [
    { src: interRegular, fontWeight: 400 },
    { src: interMedium, fontWeight: 500 },
    { src: interSemiBold, fontWeight: 600 },
  ],
});

Font.register({
  family: "JetBrainsMono",
  src: jetBrainsMonoMedium,
  fontWeight: 500,
});

const COLOR = {
  ink: "#262626",
  inkSoft: "#525252",
  inkMuted: "#7a7a7a",
  inkFaint: "#aaaaaa",
  rule: "#dcdcdc",
  ruleStrong: "#b3b3b3",
  accent: "#c69146",
  surface: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Inter",
    fontSize: 9.5,
    color: COLOR.ink,
    lineHeight: 1.45,
    backgroundColor: COLOR.surface,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.ink,
  },
  brand: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    letterSpacing: 1.6,
    color: COLOR.ink,
  },
  brandTag: {
    fontFamily: "JetBrainsMono",
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: COLOR.inkFaint,
    marginLeft: 8,
  },
  headerMeta: {
    fontFamily: "JetBrainsMono",
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: COLOR.inkMuted,
  },
  kicker: {
    fontFamily: "JetBrainsMono",
    fontSize: 7.5,
    letterSpacing: 1.6,
    color: COLOR.inkMuted,
    textTransform: "uppercase",
  },
  kickerAccent: { color: COLOR.accent, marginRight: 4 },
  h1: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 28,
    letterSpacing: -0.4,
    lineHeight: 1.05,
    color: COLOR.ink,
    marginTop: 14,
  },
  model: {
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    letterSpacing: 1.2,
    color: COLOR.ink,
    marginTop: 12,
  },
  description: {
    marginTop: 16,
    fontSize: 9.5,
    color: COLOR.inkSoft,
    lineHeight: 1.6,
  },
  cert: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 5,
  },
  certChip: {
    borderWidth: 0.6,
    borderColor: COLOR.ruleStrong,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: "JetBrainsMono",
    fontSize: 7,
    letterSpacing: 1.2,
    color: COLOR.ink,
  },
  identGrid: {
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: COLOR.ink,
  },
  identCell: { flex: 1 },
  identLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 7,
    letterSpacing: 1.6,
    color: COLOR.inkMuted,
  },
  identValue: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: 500,
    color: COLOR.ink,
  },
  identValueMono: {
    marginTop: 3,
    fontFamily: "JetBrainsMono",
    fontSize: 10,
    color: COLOR.ink,
  },
  heroBlock: { marginTop: 22 },
  heroImage: {
    width: "100%",
    objectFit: "contain",
    borderWidth: 0.6,
    borderColor: COLOR.rule,
  },
  heroCaption: {
    marginTop: 6,
    fontFamily: "JetBrainsMono",
    fontSize: 7,
    letterSpacing: 1.4,
    color: COLOR.inkMuted,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 28,
    paddingBottom: 6,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.ink,
  },
  sectionNo: {
    fontFamily: "JetBrainsMono",
    fontSize: 13,
    color: COLOR.ink,
    marginRight: 10,
  },
  sectionLabel: {
    fontFamily: "JetBrainsMono",
    fontSize: 8.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: COLOR.ink,
    flex: 1,
  },
  sectionCount: {
    fontFamily: "JetBrainsMono",
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: COLOR.inkMuted,
  },
  specGroupHead: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  specGroupName: {
    fontFamily: "JetBrainsMono",
    fontSize: 7.5,
    letterSpacing: 1.6,
    color: COLOR.ink,
    textTransform: "uppercase",
  },
  specGroupRule: {
    flex: 1,
    height: 0.5,
    backgroundColor: COLOR.rule,
    marginLeft: 8,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderBottomWidth: 0.4,
    borderBottomColor: COLOR.rule,
    paddingVertical: 4,
  },
  specLabel: { fontSize: 9, color: COLOR.inkSoft, flex: 1, paddingRight: 12 },
  specValue: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
    color: COLOR.ink,
    textAlign: "right",
  },
  specUnit: { color: COLOR.inkMuted },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.4,
    borderBottomColor: COLOR.rule,
    paddingVertical: 8,
  },
  docNo: {
    fontFamily: "JetBrainsMono",
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: COLOR.inkMuted,
    width: 22,
  },
  docTitle: { flex: 1, fontSize: 10, fontWeight: 500, color: COLOR.ink },
  docFile: {
    marginTop: 2,
    fontFamily: "JetBrainsMono",
    fontSize: 7,
    letterSpacing: 1.2,
    color: COLOR.inkMuted,
  },
  qrBlock: {
    marginTop: 24,
    paddingTop: 14,
    borderTopWidth: 0.75,
    borderTopColor: COLOR.ink,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  qrImage: { width: 80, height: 80 },
  qrText: { flex: 1 },
  qrUrl: {
    marginTop: 4,
    fontFamily: "JetBrainsMono",
    fontSize: 8,
    color: COLOR.inkSoft,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 0.4,
    borderTopColor: COLOR.rule,
    fontFamily: "JetBrainsMono",
    fontSize: 7,
    letterSpacing: 1.4,
    color: COLOR.inkMuted,
  },
});

export type PdfProductInput = {
  name: string;
  modelNumber: string;
  description: string | null;
  certifications: string[];
  specs: ProductSpec[];
  /** 封面图字节 + 真实格式（route 已按 magic bytes 判定；react-pdf 只认 png/jpg）。 */
  coverImage: { data: Uint8Array; format: "png" | "jpg" } | null;
  documents: { title: string; fileName: string; fileUrl: string }[];
  url: string;
  /** Document reference code; renamed from `ref` to avoid React ref semantics. */
  docRef: string;
  updated: string;
  qrDataUrl: string;
};

function Kicker({ children }: { children: string }) {
  return (
    <Text style={styles.kicker}>
      <Text style={styles.kickerAccent}>/</Text>
      {children}
    </Text>
  );
}

function SectionHead({
  no,
  label,
  count,
}: {
  no: string;
  label: string;
  count?: number;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionNo}>{no}.</Text>
      <Text style={styles.sectionLabel}>{label}</Text>
      {typeof count === "number" && (
        <Text style={styles.sectionCount}>
          {String(count).padStart(2, "0")} {count === 1 ? "item" : "items"}
        </Text>
      )}
    </View>
  );
}

function groupSpecsForPdf(specs: ProductSpec[]) {
  const groups: { name: string; items: ProductSpec[] }[] = [];
  const index = new Map<string, number>();
  for (const s of specs) {
    const key = s.group ?? "";
    let i = index.get(key);
    if (i === undefined) {
      i = groups.length;
      index.set(key, i);
      groups.push({ name: key, items: [] });
    }
    groups[i].items.push(s);
  }
  return groups;
}

export function ProductPdf({
  name,
  modelNumber,
  description,
  certifications,
  specs,
  coverImage,
  documents,
  url,
  docRef,
  updated,
  qrDataUrl,
}: PdfProductInput) {
  const specGroups = groupSpecsForPdf(specs);

  return (
    // 纯展示定位：PDF 不带任何工厂 / 品牌署名（标题、作者、页眉、字段均不含厂家信息）。
    <Document
      title={`${modelNumber} · ${name}`}
      creator="Luzdex"
      producer="Luzdex"
    >
      <Page size="A4" style={styles.page}>
        {/* Top strip — neutral datasheet mark, no brand */}
        <View style={styles.headerRow} fixed>
          <Text style={styles.brand}>DATASHEET</Text>
          <Text style={styles.headerMeta}>
            REF · {docRef}    REV · {updated}
          </Text>
        </View>

        {/* §01 Identification */}
        <View>
          <Text style={[styles.h1, { marginTop: 24 }]}>{name}</Text>
          <Text style={styles.model}>{modelNumber}</Text>

          {description && (
            <Text style={styles.description}>{description}</Text>
          )}

          {certifications.length > 0 && (
            <View style={styles.cert}>
              {certifications.map((c) => (
                <Text key={c} style={styles.certChip}>
                  {c}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.identGrid}>
            <View style={styles.identCell}>
              <Text style={styles.identLabel}>MODEL</Text>
              <Text style={styles.identValueMono}>{modelNumber}</Text>
            </View>
            <View style={styles.identCell}>
              <Text style={styles.identLabel}>REF</Text>
              <Text style={styles.identValueMono}>{docRef}</Text>
            </View>
            <View style={styles.identCell}>
              <Text style={styles.identLabel}>REVISION</Text>
              <Text style={styles.identValueMono}>{updated}</Text>
            </View>
          </View>
        </View>

        {/* Hero figure — 仅在拿到可渲染的封面(png/jpg)时才画，避免留空框 */}
        {coverImage && (
          <View style={styles.heroBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image
              src={{ data: Buffer.from(coverImage.data), format: coverImage.format }}
              style={[styles.heroImage, { height: 220 }]}
            />
            <Text style={styles.heroCaption}>
              {modelNumber} · FIG. 01
            </Text>
          </View>
        )}

        {/* §02 Specifications */}
        {specs.length > 0 && (
          <View>
            <SectionHead no="02" label="Specifications" count={specs.length} />
            {specGroups.map((g, gi) => (
              <View key={gi} wrap={false}>
                {g.name ? (
                  <View style={styles.specGroupHead}>
                    <Text style={styles.specGroupName}>{g.name}</Text>
                    <View style={styles.specGroupRule} />
                    <Text style={styles.sectionCount}>
                      {String(g.items.length).padStart(2, "0")}
                    </Text>
                  </View>
                ) : null}
                {g.items.map((s, i) => (
                  <View key={`${gi}-${i}`} style={styles.specRow}>
                    <Text style={styles.specLabel}>{s.label}</Text>
                    <Text style={styles.specValue}>
                      {s.value}
                      {s.unit ? <Text style={styles.specUnit}> {s.unit}</Text> : null}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* §03 Documents */}
        {documents.length > 0 && (
          <View>
            <SectionHead no="03" label="Documents" count={documents.length} />
            {documents.map((d, i) => (
              <View key={i} style={styles.docRow}>
                <Text style={styles.docNo}>{String(i + 1).padStart(2, "0")}</Text>
                <View style={{ flex: 1 }}>
                  <Link src={d.fileUrl} style={styles.docTitle}>
                    {d.title}
                  </Link>
                  <Text style={styles.docFile}>{d.fileName}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* QR access block */}
        <View style={styles.qrBlock} wrap={false}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qrDataUrl} style={styles.qrImage} />
          <View style={styles.qrText}>
            <Kicker>Scan for live datasheet</Kicker>
            <Text style={[styles.identValue, { marginTop: 6 }]}>
              Latest revision is always served at:
            </Text>
            <Link src={url} style={styles.qrUrl}>
              {url}
            </Link>
            <Text style={{ marginTop: 10, fontSize: 8.5, color: COLOR.inkSoft }}>
              The QR mark above mirrors the printed code on the product. Scan
              it any time to retrieve the current specification, certificates,
              and reference media.
            </Text>
          </View>
        </View>

        {/* Page footer */}
        <View style={styles.footer} fixed>
          <Text>
            DOC · {docRef} — {modelNumber}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `PAGE ${String(pageNumber).padStart(2, "0")} / ${String(
                totalPages
              ).padStart(2, "0")}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
