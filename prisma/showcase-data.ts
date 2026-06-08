// 产品「展示内容」种子数据（卖点带 / 亮点图标排 / 京东式图文长详情）。
// 单一数据源：seed.ts 建库时写入，backfill-showcase.ts 对既有库补写。
// icon 取值见 src/components/showcase-editor.tsx 的 ICONS 白名单。

import { img } from "./product-images.js";

export type ShowcaseHighlight = { icon: string; label: string; value?: string };
export type ShowcaseBlock =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string }
  | { kind: "image"; url: string; caption?: string };
export type ShowcaseApplication = {
  icon: string;
  title: string;
  desc?: string;
  image?: string;
};
export type ShowcaseFaq = { q: string; a: string };
export type Showcase = {
  tagline: string;
  highlights: ShowcaseHighlight[];
  detailBlocks: ShowcaseBlock[];
  applications?: ShowcaseApplication[];
  faq?: ShowcaseFaq[];
};

// 终端顾客 · 产品使用向常见问题（安装 / 色温 / 防护 / 寿命质保 / 配件）。
// 纯展示种草站定位（PLAN.md §7）：不放采购向内容（OEM / 起订 / 交期 / 样品），
// 不出现任何联系 / 价格 / 厂家出口。各产品默认复用，可按需覆盖。
const PRODUCT_FAQ: ShowcaseFaq[] = [
  {
    q: "安装方便吗？",
    a: "随附标准安装附件，嵌入 / 吸顶 / 支架等常见方式按说明即可固定到位，无需额外改造。",
  },
  {
    q: "色温（光色）怎么选？",
    a: "暖光（约 3000K）适合居家放松，中性光（约 4000K）适合商铺办公，冷白（约 6000K）适合工业与高亮场景；具体色温以包装标识与上方规格表为准。",
  },
  {
    q: "可以用在潮湿或户外环境吗？",
    a: "以产品防护等级（IP）为准：达到 IP65 及以上可用于潮湿 / 户外环境，室内款建议用于干燥场所。",
  },
  {
    q: "使用寿命和质保多久？",
    a: "采用长寿命 LED 光源，正常使用寿命可达数万小时；整灯质保年限以包装 / 保修卡标识为准。",
  },
  {
    q: "包装内含哪些配件？",
    a: "标配灯具主体及安装附件，具体清单以实际包装为准。",
  },
];

export const SHOWCASE: Record<string, Showcase> = {
  "led-strip-2835-ip65": {
    tagline: "IP65 防水灌封 · 120 灯/米高密度 · 现场可剪裁",
    highlights: [
      { icon: "droplet", label: "PU 灌封防水", value: "IP65" },
      { icon: "zap", label: "每米功率", value: "14.4W" },
      { icon: "bulb", label: "灯珠密度", value: "120/m" },
      { icon: "clock", label: "L70 寿命", value: "50,000h" },
    ],
    detailBlocks: [
      { kind: "heading", text: "为长距离连续布灯而生" },
      {
        kind: "text",
        text: "采用 2835 高亮灯珠，每米 120 颗密排，发光均匀无暗区。PU 二次灌封工艺让灯带在潮湿、多尘的户外环境下依然稳定工作，适合建筑轮廓、招牌标识与景观线条照明。",
      },
      {
        kind: "image",
        url: img("stripApplication"),
        caption: "建筑轮廓应用 · 均匀连续光线",
      },
      { kind: "heading", text: "现场施工友好" },
      {
        kind: "text",
        text: "每 50mm 设剪裁点，可按需断开；端接式接头免焊接快速连接，单段最长可串接 5 米。配合同系列铝槽散热，进一步延长寿命。",
      },
      {
        kind: "image",
        url: img("stripClose"),
        caption: "可按剪裁点自由断开 · 端接快接",
      },
    ],
    applications: [
      {
        icon: "ruler",
        title: "建筑轮廓",
        desc: "勾勒楼宇线条与檐口，夜间塑造连续光带。",
        image: img("stripApplication", 1200),
      },
      {
        icon: "bulb",
        title: "招牌标识",
        desc: "门头、广告字背发光，均匀无暗点。",
        image: img("stripClose", 1200),
      },
      {
        icon: "droplet",
        title: "景观线条",
        desc: "户外台阶、栏杆、水景轮廓防水照明。",
        image: img("stripApplication", 1200),
      },
    ],
    faq: PRODUCT_FAQ,
  },

  "led-downlight-9w": {
    tagline: "三色温一键切换 · 高显指 Ra85 · 75mm 标准开孔",
    highlights: [
      { icon: "sun", label: "三色温可调", value: "3CCT" },
      { icon: "bulb", label: "显色指数", value: "Ra≥85" },
      { icon: "ruler", label: "标准开孔", value: "Ø75" },
      { icon: "zap", label: "整灯功率", value: "9W" },
    ],
    detailBlocks: [
      { kind: "heading", text: "一盏灯，三种氛围" },
      {
        kind: "text",
        text: "灯体侧边拨动开关即可在 3000K 暖光、4000K 中性光、6500K 冷白之间切换，无需更换灯具即可适配客厅、商铺、办公等不同场景。",
      },
      {
        kind: "image",
        url: img("downlightCeiling"),
        caption: "暖光 / 中性 / 冷白 一键切换",
      },
      { kind: "heading", text: "无主灯设计首选" },
      {
        kind: "text",
        text: "Ø75mm 国标开孔，适配国内主流吊顶系统；压铸铝 + PC 面罩兼顾散热与柔和出光，Ra≥85 高显色还原物品真实质感。",
      },
    ],
    applications: [
      {
        icon: "bulb",
        title: "家居客厅",
        desc: "无主灯设计基础照明，暖光营造居家氛围。",
        image: img("downlightCeiling", 1200),
      },
      {
        icon: "sun",
        title: "商铺零售",
        desc: "中性光重点照明，还原商品真实色彩。",
        image: img("downlightInterior", 1200),
      },
      {
        icon: "gauge",
        title: "办公空间",
        desc: "冷白光均匀照明，提升空间通透感。",
        image: img("downlightInterior", 1200),
      },
    ],
    faq: PRODUCT_FAQ,
  },

  "led-floodlight-100w": {
    tagline: "IP66 全防水 · IK08 抗冲击 · 130lm/W 高光效",
    highlights: [
      { icon: "droplet", label: "防水防尘", value: "IP66" },
      { icon: "shield", label: "抗冲击", value: "IK08" },
      { icon: "sun", label: "整灯光效", value: "130lm/W" },
      { icon: "gauge", label: "总光通量", value: "13,000lm" },
    ],
    detailBlocks: [
      { kind: "heading", text: "户外远投，全天候稳定" },
      {
        kind: "text",
        text: "压铸铝外壳 + 钢化玻璃，IP66 全防水加 IK08 抗冲击，可直面暴雨、扬尘与意外撞击。130lm/W 高光效在广告牌、体育场、建筑立面等大场景实现远距离均匀投射。",
      },
      {
        kind: "image",
        url: img("floodlightStadium"),
        caption: "建筑外立面泛光照明",
      },
      { kind: "heading", text: "宽压输入，全球适配" },
      {
        kind: "text",
        text: "AC 100–277V 宽电压输入，电网波动也能稳定点亮；可调支架便于现场对准投射角度，安装一次长期免维护。",
      },
      {
        kind: "image",
        url: img("floodlightMast"),
        caption: "可调支架 · 现场快速对准",
      },
    ],
    applications: [
      {
        icon: "ruler",
        title: "建筑立面",
        desc: "大楼外墙泛光，远距离均匀投射。",
        image: img("floodlightStadium", 1200),
      },
      {
        icon: "sun",
        title: "广告牌",
        desc: "大型广告牌前投照明，亮度充足。",
        image: img("floodlightMast", 1200),
      },
      {
        icon: "shield",
        title: "体育场馆",
        desc: "球场、堆场大面积高强度照明。",
        image: img("floodlightStadium", 1200),
      },
    ],
    faq: PRODUCT_FAQ,
  },

  "led-streetlight-solar-60w": {
    tagline: "一体化免布线 · 雨天续航 3 天 · 磷酸铁锂长循环",
    highlights: [
      { icon: "battery", label: "雨天续航", value: "3 天" },
      { icon: "sun", label: "单晶光伏板", value: "80W" },
      { icon: "clock", label: "电池循环", value: "≥2000 次" },
      { icon: "droplet", label: "整灯防护", value: "IP65" },
    ],
    detailBlocks: [
      { kind: "heading", text: "无市电也能亮" },
      {
        kind: "text",
        text: "光伏板、锂电池、灯头、控制器一体集成，无需外部布线与开挖，特别适合乡村道路、园区与电网未覆盖区域。白天充电、夜晚自动点亮，光控 + 人体感应智能调光省电。",
      },
      {
        kind: "image",
        url: img("solarStreetlight"),
        caption: "一体化灯头 · 免布线安装",
      },
      { kind: "heading", text: "续航有保障" },
      {
        kind: "text",
        text: "30Ah 磷酸铁锂电池循环寿命 ≥2000 次，连续阴雨天可续航 3 天，安全性与寿命远优于普通铅酸电池。",
      },
    ],
    applications: [
      {
        icon: "battery",
        title: "乡村道路",
        desc: "电网未覆盖区域免布线点亮，太阳能自供电。",
        image: img("solarStreetlightRoad", 1200),
      },
      {
        icon: "sun",
        title: "园区厂区",
        desc: "厂区道路、停车场绿色节能照明。",
        image: img("solarStreetlight", 1200),
      },
      {
        icon: "droplet",
        title: "景区公园",
        desc: "IP65 防护，户外景观道路全天候稳定。",
        image: img("solarStreetlightRoad", 1200),
      },
    ],
    faq: PRODUCT_FAQ,
  },

  "led-highbay-200w": {
    tagline: "140lm/W 高光效 · 90°/120° 配光可选 · LM-80 认证",
    highlights: [
      { icon: "sun", label: "整灯光效", value: "140lm/W" },
      { icon: "gauge", label: "总光通量", value: "28,000lm" },
      { icon: "award", label: "光衰认证", value: "LM-80" },
      { icon: "ruler", label: "安装高度", value: "8–15m" },
    ],
    detailBlocks: [
      { kind: "heading", text: "高空大面积照明利器" },
      {
        kind: "text",
        text: "200W 大功率配合 140lm/W 高光效，单灯即可覆盖大面积作业区。圆形铝鳍片散热结构有效控温，保障光源长期稳定不衰减，适配 8–15 米安装高度。",
      },
      {
        kind: "image",
        url: img("highbayWarehouse"),
        caption: "仓库 / 厂房高棚照明",
      },
      { kind: "heading", text: "配光可选，按场景定制" },
      {
        kind: "text",
        text: "提供 90° 与 120° 两种配光：90° 适合高货架仓库聚光下照，120° 适合厂房车间大范围铺光。已通过 LM-80 6,000 小时光衰测试。",
      },
      {
        kind: "image",
        url: img("highbayFixture"),
        caption: "铝鳍片散热结构特写",
      },
    ],
    applications: [
      {
        icon: "gauge",
        title: "仓储物流",
        desc: "高货架仓库 90° 聚光下照，照度均匀。",
        image: img("highbayWarehouse", 1200),
      },
      {
        icon: "ruler",
        title: "工厂车间",
        desc: "120° 宽配光大范围铺光，作业更清晰。",
        image: img("highbayFixture", 1200),
      },
      {
        icon: "award",
        title: "展馆场馆",
        desc: "高棚空间大功率照明，长寿命免维护。",
        image: img("highbayWarehouse", 1200),
      },
    ],
    faq: PRODUCT_FAQ,
  },

  "led-panel-36w-600": {
    tagline: "UGR<19 防眩光 · 超薄导光板 · DALI/0–10V 调光",
    highlights: [
      { icon: "shield", label: "防眩光", value: "UGR<19" },
      { icon: "sun", label: "整灯光效", value: "120lm/W" },
      { icon: "bulb", label: "显色指数", value: "Ra≥85" },
      { icon: "gauge", label: "可调光", value: "DALI" },
    ],
    detailBlocks: [
      { kind: "heading", text: "办公照明的舒适之选" },
      {
        kind: "text",
        text: "UGR<19 低眩光光学设计，长时间伏案也不刺眼；超薄导光板让整面发光均匀柔和，无频闪呵护视力，是办公室、医院、教室吊顶照明的理想方案。",
      },
      {
        kind: "image",
        url: img("panelCeiling"),
        caption: "开放式办公区均匀照明",
      },
      { kind: "heading", text: "智能调光，灵活适配" },
      {
        kind: "text",
        text: "支持 DALI 与 0–10V 调光协议，可接入楼宇智能照明系统按需调节亮度；595×595×12mm 超薄机身适配主流硅钙板与轻钢龙骨吊顶，安装快捷。",
      },
    ],
    applications: [
      {
        icon: "gauge",
        title: "开放办公",
        desc: "UGR<19 防眩，长时间伏案不刺眼。",
        image: img("panelCeiling", 1200),
      },
      {
        icon: "shield",
        title: "医院教室",
        desc: "无频闪柔和出光，呵护视力。",
        image: img("panelCeiling", 1200),
      },
      {
        icon: "bulb",
        title: "会议商务",
        desc: "均匀面光提升空间质感与专业度。",
        image: img("downlightInterior", 1200),
      },
    ],
    faq: PRODUCT_FAQ,
  },
};

// 产品级附加项（灯具类型 + 盒内清单 + 安装），与 SHOWCASE 同 slug 关联。
// 灯具类型手动定；盒内/安装为演示草稿（真实可由后台 AI 一键生成 + 人工确认）。
export type ProductExtras = {
  luminaireType: string;
  boxContents: { item: string; qty?: string }[];
  install: { method: string; steps: string[] };
};

export const PRODUCT_EXTRAS: Record<string, ProductExtras> = {
  "led-strip-2835-ip65": {
    luminaireType: "strip",
    boxContents: [
      { item: "LED 灯带", qty: "1 卷" },
      { item: "端接快接头", qty: "2 个" },
      { item: "固定卡扣", qty: "若干" },
      { item: "说明书", qty: "1 份" },
    ],
    install: {
      method: "背胶粘贴或卡扣固定，按剪裁点裁剪、端接头免焊连接。",
      steps: [
        "清洁安装面，确保干燥无尘",
        "按需在剪裁点处裁剪灯带",
        "撕背胶粘贴或用卡扣固定到位",
        "用端接头连接电源，通电检查",
      ],
    },
  },
  "led-downlight-9w": {
    luminaireType: "downlight",
    boxContents: [
      { item: "筒灯灯体（含弹簧卡扣）", qty: "1 个" },
      { item: "接线端子", qty: "1 个" },
      { item: "说明书 / 保修卡", qty: "1 份" },
    ],
    install: {
      method: "吊顶开孔嵌入，弹簧卡扣自锁固定。",
      steps: [
        "吊顶按 Ø75mm 开孔",
        "接好驱动电源接线",
        "捏起弹簧卡扣，将灯体推入孔位",
        "松手让卡扣自锁，通电检查",
      ],
    },
  },
  "led-floodlight-100w": {
    luminaireType: "floodlight",
    boxContents: [
      { item: "投光灯灯体", qty: "1 个" },
      { item: "可调安装支架", qty: "1 套" },
      { item: "膨胀螺丝包", qty: "1 包" },
      { item: "说明书 / 保修卡", qty: "1 份" },
    ],
    install: {
      method: "支架固定到墙面或立杆，调整投射角度后锁紧。",
      steps: [
        "用膨胀螺丝将支架固定到墙面/立杆",
        "将灯体装上支架",
        "做好防水接线",
        "调整投射角度并锁紧螺栓",
      ],
    },
  },
  "led-streetlight-solar-60w": {
    luminaireType: "streetlight",
    boxContents: [
      { item: "一体化灯头（含光伏板/电池）", qty: "1 套" },
      { item: "抱箍 / 安装支架", qty: "1 套" },
      { item: "遥控器", qty: "1 个" },
      { item: "说明书 / 保修卡", qty: "1 份" },
    ],
    install: {
      method: "抱箍上杆固定，免布线，光控自动点亮。",
      steps: [
        "用抱箍将灯头固定到灯杆顶端",
        "调整光伏板朝向以获得最佳采光",
        "撕去电池绝缘片激活",
        "遥控设置模式，入夜自动点亮",
      ],
    },
  },
  "led-highbay-200w": {
    luminaireType: "highbay",
    boxContents: [
      { item: "高棚灯灯体", qty: "1 个" },
      { item: "吊装挂钩 / 吊环", qty: "1 套" },
      { item: "钢丝绳（防坠）", qty: "1 根" },
      { item: "说明书 / 保修卡", qty: "1 份" },
    ],
    install: {
      method: "吊钩/吊环高空吊装，加挂防坠钢丝绳。",
      steps: [
        "在顶部结构安装吊点",
        "将灯体吊环挂上吊点",
        "加挂防坠钢丝绳",
        "做好高空接线，通电检查",
      ],
    },
  },
  "led-panel-36w-600": {
    luminaireType: "panel",
    boxContents: [
      { item: "LED 面板灯", qty: "1 块" },
      { item: "独立驱动电源", qty: "1 个" },
      { item: "吊装钢丝 / 嵌入弹簧", qty: "1 套" },
      { item: "说明书 / 保修卡", qty: "1 份" },
    ],
    install: {
      method: "嵌入吊顶龙骨，或用钢丝吊装、表面吸顶。",
      steps: [
        "接好独立驱动电源",
        "将面板嵌入 600×600 龙骨格（或装吊装件）",
        "理顺线缆、固定到位",
        "通电检查出光",
      ],
    },
  },
};
