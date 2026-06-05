import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from "@react-pdf/renderer";

// Mono for codes — model numbers are ASCII business keys, no CJK needed here.
Font.register({
  family: "JetBrainsMono",
  src: "https://fonts.gstatic.com/s/jetbrainsmono/v25/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.ttf",
  fontWeight: 500,
});

const COLOR = {
  ink: "#262626",
  inkMuted: "#7a7a7a",
  inkFaint: "#aaaaaa",
  rule: "#dcdcdc",
  surface: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 44,
    paddingHorizontal: 36,
    fontFamily: "JetBrainsMono",
    backgroundColor: COLOR.surface,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 8,
    marginBottom: 18,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.ink,
  },
  brand: { fontSize: 9, letterSpacing: 1.4, color: COLOR.ink },
  meta: { fontSize: 7.5, letterSpacing: 1.2, color: COLOR.inkMuted },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "33.33%",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  qrBox: {
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    borderRadius: 6,
    padding: 6,
  },
  qr: { width: 116, height: 116 },
  model: {
    marginTop: 8,
    fontSize: 9,
    letterSpacing: 0.5,
    color: COLOR.ink,
    textAlign: "center",
  },
  slug: {
    marginTop: 2,
    fontSize: 6.5,
    letterSpacing: 0.8,
    color: COLOR.inkFaint,
    textAlign: "center",
  },
});

export interface QrSheetItem {
  qrDataUrl: string;
  modelNumber: string;
  slug: string;
}

export function QrSheetPdf({
  factoryName,
  source,
  dateStr,
  items,
}: {
  factoryName: string;
  source: string | null;
  dateStr: string;
  items: QrSheetItem[];
}) {
  const tag = source ? `SOURCE · ${source.toUpperCase()}` : "SOURCE · DIRECT";
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>{factoryName} — QR SHEET</Text>
          <Text style={styles.meta}>
            {tag} · {items.length} ITEMS · {dateStr}
          </Text>
        </View>
        <View style={styles.grid}>
          {items.map((it) => (
            <View key={it.slug} style={styles.cell} wrap={false}>
              <View style={styles.qrBox}>
                {/* react-pdf Image，非 HTML img，无 alt 概念 */}
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image style={styles.qr} src={it.qrDataUrl} />
              </View>
              <Text style={styles.model}>{it.modelNumber}</Text>
              <Text style={styles.slug}>/{it.slug}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
