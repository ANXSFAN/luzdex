-- 灯具类型从中文自由文本归一到稳定枚举 key
UPDATE "products" SET "luminaire_type" = 'strip'       WHERE "luminaire_type" = '灯带';
UPDATE "products" SET "luminaire_type" = 'downlight'   WHERE "luminaire_type" = '筒灯';
UPDATE "products" SET "luminaire_type" = 'floodlight'  WHERE "luminaire_type" = '投光灯';
UPDATE "products" SET "luminaire_type" = 'streetlight' WHERE "luminaire_type" IN ('太阳能路灯', '路灯');
UPDATE "products" SET "luminaire_type" = 'highbay'     WHERE "luminaire_type" IN ('高棚灯', '工矿灯', 'UFO 工矿灯');
UPDATE "products" SET "luminaire_type" = 'panel'       WHERE "luminaire_type" = '面板灯';
