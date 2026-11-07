// 六和尾牙大作戰（改編自山頂國小《小編萬聖夜》）：所有數值、關卡、劇情都在這裡（瀏覽器與 node 共用；改完跑 node tools/sim.js 看通關率）
(function (G) {
  // 世界尺寸（px）：一間餐廳廳房 600×400，樓板 40 厚；小六約 110 高
  const ROOM = { W: 600, H: 400, T: 40 };

  // magnet：金元寶在這個距離內才會飛過來（太遠要自己走過去撿）
  const PLAYER = { hp: 100, spd: 210, climb: 180, r: 26, h: 110, magnet: 200, pick: 60, search: 2 };

  // 升級經驗：第 n 級升到 n+1 要幾顆糖
  const needXp = (lv) => Math.round(3 + lv * 2.2 + lv * lv * 0.08);

  // 怪物：r 半徑、spd 每秒 px、dmg 碰一下扣多少、xp 掉幾顆糖、fly 會飛（穿樓板）
  const MONS = {
    pumpkin: { name: '紅蝦怪', img: 'm-pumpkin', hp: 20, spd: 105, r: 22, dmg: 5, xp: 1 },
    bat:     { name: '飛盤怪', img: 'm-bat', hp: 9, spd: 150, r: 17, dmg: 4, xp: 1, fly: true },
    ghost:   { name: '海膽怪', img: 'm-ghost', hp: 46, spd: 70, r: 25, dmg: 7, xp: 2, fly: true },
    mummy:   { name: '米糕怪', img: 'm-mummy', hp: 120, spd: 62, r: 27, dmg: 10, xp: 4 },
    // 工廠關卡專用（前兩關）：搞笑的 NG 煞車盤、黑暗的 NG 輪圈（圖片 art/f-m-ngdisc、f-m-ngwheel）
    ngdisc:  { name: 'NG 不良品煞車盤', img: 'm-ngdisc', hp: 28, spd: 125, r: 24, dmg: 5, xp: 1 },
    ngwheel: { name: 'NG 不良品輪圈', img: 'm-ngwheel', hp: 85, spd: 92, r: 27, dmg: 9, xp: 3 },
    boss:    { name: '大龍蝦王', img: 'm-boss', hp: 16000, spd: 42, r: 74, dmg: 20, xp: 60, boss: true },
    ghostking: { name: '石斑魚王', img: 'm-ghostboss', hp: 4500, spd: 50, r: 62, dmg: 14, xp: 40, boss: true, fly: true, summon: 'ghost' },
  };

  // 技能：kind w＝武器（最多同時帶 MAXW 種）、p＝被動；rare 稀有度 1 普通、2 稀有、3 史詩（越稀有越少出現）
  // icon：技能圖示表 skills 的格子，100 以上是第二張 skills2；lv 是每一級的數值（1～5 級），desc 是卡片上的說明
  const SKILLS = {
    candy: { name: '筷子連發', icon: 0, kind: 'w', rare: 1,
      lv: [{ cd: .6, n: 1, dmg: 20, pierce: 0 }, { cd: .55, n: 2, dmg: 22, pierce: 0 }, { cd: .5, n: 2, dmg: 26, pierce: 1 }, { cd: .45, n: 3, dmg: 30, pierce: 1 }, { cd: .38, n: 4, dmg: 36, pierce: 2 }],
      desc: ['自動朝最近的怪射筷子', '一次射 2 根', '更痛，可以穿過 1 隻', '一次射 3 根', '一次 4 根，穿過 2 隻'] },
    glow: { name: '紅綢帶', icon: 1, kind: 'w', rare: 2,
      lv: [{ n: 2, len: 150, spd: 3.2, dmg: 12 }, { n: 3, len: 155, spd: 3.4, dmg: 14 }, { n: 3, len: 175, spd: 3.8, dmg: 18 }, { n: 4, len: 185, spd: 4.1, dmg: 22 }, { n: 5, len: 205, spd: 4.5, dmg: 28 }],
      desc: ['紅綢帶繞著身體轉，碰到的怪被撞飛', '變 3 條', '更長、甩更快', '變 4 條', '5 條，又長又痛'] },
    bomb: { name: '鍋蓋', icon: 2, kind: 'w', rare: 2,
      lv: [{ cd: 2.6, n: 1, dmg: 36, r: 110 }, { cd: 2.3, n: 2, dmg: 40, r: 115 }, { cd: 2.1, n: 2, dmg: 50, r: 130 }, { cd: 1.9, n: 3, dmg: 58, r: 140 }, { cd: 1.6, n: 4, dmg: 70, r: 155 }],
      desc: ['往怪最多的地方砸鍋蓋', '一次砸 2 個', '砸得更大更痛', '一次砸 3 個', '一次 4 個'] },
    flash: { name: '服務鈴', icon: 3, kind: 'w', rare: 1,
      lv: [{ cd: 4.2, r: 190, dmg: 18, stun: .6 }, { cd: 3.8, r: 210, dmg: 24, stun: .7 }, { cd: 3.4, r: 225, dmg: 30, stun: .8 }, { cd: 3, r: 240, dmg: 38, stun: .9 }, { cd: 2.5, r: 265, dmg: 48, stun: 1 }],
      desc: ['叮～周圍的怪被嚇到定住', '範圍更大', '更痛、定更久', '按得更勤', '超大聲'] },
    beam: { name: '噴火槍', icon: 4, kind: 'w', rare: 2,
      lv: [{ cd: 3.2, n: 1, len: 620, w: 34, dps: 110, dur: .6 }, { cd: 3, n: 2, len: 650, w: 36, dps: 120, dur: .65 }, { cd: 2.7, n: 2, len: 700, w: 42, dps: 150, dur: .7 }, { cd: 2.4, n: 3, len: 740, w: 44, dps: 170, dur: .75 }, { cd: 2, n: 4, len: 800, w: 50, dps: 210, dur: .8 }],
      desc: ['桌邊炙燒！火焰一掃燒過一整排', '一次 2 支', '火力更大更痛', '一次 3 支', '一次 4 支'] },
    buddy: { name: '圓桌轉盤', icon: 5, kind: 'w', rare: 2,
      lv: [{ cd: 3.2, dmg: 16, r: 85, spin: 1.4 }, { cd: 2.9, dmg: 20, r: 95, spin: 1.6 }, { cd: 2.6, dmg: 24, r: 110, spin: 1.8 }, { cd: 2.3, dmg: 30, r: 120, spin: 2.0 }, { cd: 2.0, dmg: 38, r: 140, spin: 2.4 }],
      desc: ['把圓桌轉盤丟到怪最多的地方，落地狂轉把怪捲進來', '轉更久更痛', '捲更大圈', '拋得更勤', '超大轉盤龍捲風'] },
    thunder: { name: '天降抽獎球', icon: 6, kind: 'w', rare: 3,
      lv: [{ cd: 3, n: 1, dmg: 48, r: 70 }, { cd: 2.7, n: 2, dmg: 52, r: 75 }, { cd: 2.4, n: 3, dmg: 62, r: 85 }, { cd: 2.1, n: 4, dmg: 72, r: 90 }, { cd: 1.7, n: 5, dmg: 90, r: 100 }],
      desc: ['抽獎球從天而降，隨機砸畫面裡的怪', '一次 2 顆', '一次 3 顆', '一次 4 顆', '一次 5 顆'] },
    brew: { name: '醬油', icon: 7, kind: 'w', rare: 1,
      lv: [{ cd: 1.6, dur: 3, r: 72, dps: 26, slow: .4 }, { cd: 1.5, dur: 3.6, r: 80, dps: 32, slow: .45 }, { cd: 1.4, dur: 4.2, r: 90, dps: 40, slow: .5 }, { cd: 1.3, dur: 4.8, r: 98, dps: 48, slow: .55 }, { cd: 1.1, dur: 5.5, r: 110, dps: 60, slow: .6 }],
      desc: ['走過的地方灑滿醬油，怪會滑倒變慢', '醬油留更久', '灑更大片', '更滑', '整條走道都是醬油'] },
    frost: { name: '冷氣', icon: 8, kind: 'w', rare: 1,
      lv: [{ r: 150, slow: .3, dps: 8 }, { r: 170, slow: .35, dps: 12 }, { r: 190, slow: .42, dps: 16 }, { r: 210, slow: .5, dps: 22 }, { r: 235, slow: .58, dps: 30 }],
      desc: ['身邊一直吹冷氣，靠近的怪走很慢', '範圍更大', '風更強', '更強更大', '開到最強段'] },
    hero: { name: '打怪超人', icon: 'hero', kind: 'w', rare: 2,
      lv: [{ dmg: 40, r: 95, spd: 520 }, { dmg: 52, r: 100, spd: 560 }, { dmg: 64, r: 112, spd: 600 }, { dmg: 78, r: 120, spd: 640 }, { dmg: 96, r: 135, spd: 700 }],
      desc: ['老闆來幫忙！變身打怪超人打 20 秒，變回老闆休息 20 秒，一直輪流', '撞得更痛', '撞更大片', '飛更快更痛', '最強打怪超人'] },
    ball: { name: '湯圓', icon: 100, kind: 'w', rare: 3,
      lv: [{ cd: 2.2, bounce: 3, dmg: 34 }, { cd: 2.0, bounce: 4, dmg: 40 }, { cd: 1.8, bounce: 5, dmg: 48 }, { cd: 1.6, bounce: 6, dmg: 56 }, { cd: 1.4, bounce: 8, dmg: 66 }],
      desc: ['炸湯圓在怪跟怪之間彈來彈去，彈 3 次', '彈 4 次', '彈 5 次、更痛', '彈 6 次', '彈 8 次'] },
    flute: { name: '卡拉OK麥克風', icon: 101, kind: 'w', rare: 2,
      lv: [{ cd: 2.0, len: 360, dmg: 28, both: false }, { cd: 1.8, len: 400, dmg: 34, both: false }, { cd: 1.7, len: 420, dmg: 40, both: true }, { cd: 1.5, len: 450, dmg: 48, both: true }, { cd: 1.2, len: 500, dmg: 60, both: true }],
      desc: ['拿起麥克風高歌，前面一整片音波把怪震退', '更遠更痛', '前後都唱得到', '唱得更勤', '整條走道都是音波'] },
    tack: { name: '蝦殼', icon: 102, kind: 'w', rare: 1,
      lv: [{ cd: 2.6, n: 3, dmg: 20, dur: 6 }, { cd: 2.4, n: 4, dmg: 24, dur: 6.5 }, { cd: 2.2, n: 5, dmg: 28, dur: 7 }, { cd: 2.0, n: 6, dmg: 34, dur: 7.5 }, { cd: 1.6, n: 8, dmg: 42, dur: 8 }],
      desc: ['在地上撒蝦殼，踩到的怪會痛', '撒 4 片', '撒 5 片、更痛', '撒 6 片', '撒 8 片'] },
    eraser: { name: '麵粉袋', icon: 103, kind: 'w', rare: 1,
      lv: [{ cd: 3.0, r: 90, dps: 20, dur: 2.5 }, { cd: 2.7, r: 100, dps: 26, dur: 2.8 }, { cd: 2.4, r: 115, dps: 32, dur: 3 }, { cd: 2.1, r: 125, dps: 40, dur: 3.2 }, { cd: 1.8, r: 145, dps: 50, dur: 3.5 }],
      desc: ['丟麵粉袋炸出一團白粉，裡面的怪嗆到又變慢', '粉更多', '粉更大團', '丟得更勤', '整間廳都是麵粉'] },
    hoop: { name: '彩帶環', icon: 104, kind: 'w', rare: 3,
      lv: [{ cd: 2.6, r: 230, dmg: 30 }, { cd: 2.4, r: 250, dmg: 38 }, { cd: 2.2, r: 270, dmg: 46 }, { cd: 2.0, r: 290, dmg: 56 }, { cd: 1.7, r: 320, dmg: 70 }],
      desc: ['彩帶環從腰上一圈圈擴散出去，把怪推開', '圈更大更痛', '轉得更勤', '更大更痛', '超大彩帶環'] },
    cape: { name: '圍裙', icon: 9, kind: 'p',
      lv: [{ n: 1, cd: 9 }, { n: 1, cd: 7 }, { n: 2, cd: 7 }, { n: 2, cd: 5.5 }, { n: 3, cd: 5 }],
      desc: ['擋掉 1 次攻擊，會自己充好', '充得更快', '可以擋 2 次', '充得更快', '可以擋 3 次'] },
    shoe: { name: '防滑鞋', icon: 10, kind: 'p', lv: [{ m: 1.1 }, { m: 1.18 }, { m: 1.26 }, { m: 1.33 }, { m: 1.4 }],
      desc: ['跑快 10%', '跑快 18%', '跑快 26%', '跑快 33%', '跑快 40%'] },
    bento: { name: '尾牙桌菜', icon: 11, kind: 'p', lv: [{ hp: 25 }, { hp: 50 }, { hp: 75 }, { hp: 100 }, { hp: 130 }],
      desc: ['血量上限 +25，補滿血', '再 +25，補滿血', '再 +25，補滿血', '再 +25，補滿血', '再 +30，補滿血'] },
    magnet: { name: '抽獎券', icon: 12, kind: 'p', lv: [{ m: 1.15 }, { m: 1.3 }, { m: 1.45 }, { m: 1.6 }, { m: 1.8 }],
      desc: ['撿到的金元寶多算 15%，升級更快', '多 30%', '多 45%', '多 60%', '多 80%'] },
    clock: { name: '計時器', icon: 13, kind: 'p', lv: [{ m: .92 }, { m: .85 }, { m: .79 }, { m: .73 }, { m: .66 }],
      desc: ['所有武器快 8%', '快 15%', '快 21%', '快 27%', '快 34%'] },
  };
  // 工廠關卡（前兩關）：武器與道具換成工廠版名稱（圖示用 skillsf／skills2f 兩張圖）
  const SKILL_F = {
    candy: ['螺絲連發', ['自動朝最近的怪射螺絲', '一次射 2 顆', '更痛，可以穿過 1 隻', '一次射 3 顆', '一次 4 顆，穿過 2 隻']],
    glow: ['起重吊帶', ['吊帶繞著身體轉，碰到的怪被撞飛', '變 3 條', '更長、甩更快', '變 4 條', '5 條，又長又痛']],
    bomb: ['銅鎚', ['往怪最多的地方砸銅鎚', '一次砸 2 把', '砸得更大更痛', '一次砸 3 把', '一次 4 把']],
    flash: ['安全警報', ['嗚～周圍的怪被嚇到定住', '範圍更大', '更痛、定更久', '響得更勤', '超大聲']],
    beam: ['高壓氣槍', ['氣槍一掃吹倒一整排', '一次 2 支', '氣壓更大更痛', '一次 3 支', '一次 4 支']],
    buddy: ['迴轉工作台', ['把迴轉台丟到怪最多的地方，落地狂轉把怪捲進來', '轉更久更痛', '捲更大圈', '拋得更勤', '超大迴轉龍捲風']],
    thunder: ['天車吊鉤', ['天車吊鉤俯衝，隨機砸畫面裡的怪', '一次 2 個', '一次 3 個', '一次 4 個', '一次 5 個']],
    brew: ['切削油', ['走過的地方灑滿切削油，怪會滑倒變慢', '油留更久', '灑更大片', '更滑', '整條走道都是油']],
    frost: ['工業大電扇', ['身邊一直吹強風，靠近的怪走很慢', '範圍更大', '風更強', '更強更大', '開到最強段']],
    ball: ['滾珠軸承', ['滾珠在怪跟怪之間彈來彈去，彈 3 次', '彈 4 次', '彈 5 次、更痛', '彈 6 次', '彈 8 次']],
    flute: ['廣播喇叭', ['用廣播喇叭放聲，前面一整片音波把怪震退', '更遠更痛', '前後都放得到', '放得更勤', '整條走道都是音波']],
    tack: ['鐵屑', ['在地上撒鐵屑，踩到的怪會痛', '撒 4 把', '撒 5 把、更痛', '撒 6 把', '撒 8 把']],
    eraser: ['抹布', ['丟抹布拍出一團灰塵，裡面的怪嗆到又變慢', '灰更多', '灰更大團', '丟得更勤', '整間廠房都是灰塵']],
    hoop: ['墊圈', ['墊圈從腰上一圈圈擴散出去，把怪推開', '圈更大更痛', '轉得更勤', '更大更痛', '超大墊圈']],
    cape: ['安全帽'], shoe: ['安全鞋'], bento: ['便當'], clock: ['打卡鐘'],
    magnet: ['加班津貼', ['撿到的螺帽多算 15%，升級更快', '多 30%', '多 45%', '多 60%', '多 80%']],
  };
  const BASE = {};
  for (const k in SKILLS) BASE[k] = { name: SKILLS[k].name, desc: SKILLS[k].desc };
  // 換皮膚：'f' 工廠、'' 尾牙；之後畫面依 DATA.skin 選圖示表
  const DATA_SKIN = { skin: '' };
  function applySkin(skin) {
    DATA_SKIN.skin = skin || '';
    for (const k in SKILLS) {
      const f = skin === 'f' && SKILL_F[k];
      SKILLS[k].name = f ? f[0] : BASE[k].name; SKILLS[k].desc = f && f[1] ? f[1] : BASE[k].desc;
    }
  }
  const MAXLV = 5;
  // 困難版：怪物量變多（生怪速度、同時上限、大群人數），升級要的金元寶變多
  // 困難版：怪物約一般版 4 倍多（出怪、大群都 ×3），但每隻血只有 0.4 倍；升級要的金元寶 ×2；同時在場有上限（cap，大群也算）
  // 難度倍率（以「原本的一般」為 1）：現在的「困難」＝原本的一般；「一般」比較輕鬆
  const HARD = { spawn: 1, cap: 1, horde: 1, xp: 1, hp: 1 };
  const EASY = { spawn: 0.55, cap: 0.6, horde: 0.5, xp: 0.75, hp: 0.7 };
  const MAXW = 5;   // 武器最多同時帶 5 種，第 6 種要丟掉一種或放棄
  const RARE = { 1: { name: '普通', w: 1 }, 2: { name: '稀有', w: 0.6 }, 3: { name: '史詩', w: 0.35 } };

  // 老闆（打怪超人卡）的台詞：休息時偶爾講一句，變身、變回來各一句
  const HERO_LINES = {
    calm: ['小六，尾牙影片做好了嗎？', '那個影片做好了沒？', '小六，PPT 弄好了嗎？', '老闆說幾句話就好…'],
    tf: '變身！', back: '被鍋鏟敲好痛😭',
  };

  // 收集品（items 圖的格子編號）
  const ITEMS = {
    doc: { name: '公文夾', icon: 200 }, seal: { name: '印章', icon: 201 }, blueprint: { name: '圖面捲', icon: 202 },
    caliper: { name: '卡尺', icon: 203 }, key: { name: '公司車鑰匙', icon: 204 }, toolbox: { name: '工具箱', icon: 205 },
    lantern: { name: '紅燈籠', icon: 0 }, bucket: { name: '抽獎箱', icon: 1 }, mic: { name: '麥克風', icon: 2 },
    hat: { name: '尾牙桌牌', icon: 3 }, bunting: { name: '紅布條彩旗', icon: 4 }, bell: { name: '搖鈴', icon: 5 },
    cape: { name: '摸彩獎品袋', icon: 6 }, camera: { name: '大合照相機', icon: 7 }, radio: { name: '音響', icon: 8 },
    lolli: { name: '紅包', icon: 9 }, cookie: { name: '年糕', icon: 10 }, lights: { name: '燈串', icon: 11 },
    banner: { name: '尾牙布條', icon: 12 }, ears: { name: '財神帽', icon: 13 }, trophy: { name: '特獎大紅包', icon: 14 },
  };
  const CHEST_ICON = 15;

  // 關卡：rooms 由上到下每層的教室；ladders [樓層, 欄]＝從這層爬到上一層的梯子（欄 0.5＝第一間正中間）
  // items/chests [樓層, 欄]；start、exit [樓層, 欄]；waves：rate 每秒生幾隻（隨時間加）、mix 各種怪的比重（from 秒開始出現）
  const LEVELS = [
    { name: '組裝區', sub: '把公文送去會議室', story: 'l1', wait: 10, skin: 'f',
      rooms: ['class hall class music', 'class class hall library', 'hall gym hall class'],
      ladders: [[0, 0.5], [0, 3.5], [1, 2.5]],
      items: [['doc', 2, 0.5], ['seal', 1, 3.6], ['blueprint', 2, 3.5]], chests: [[1, 1.5]],
      start: [0, 1.5], exit: [0, 1.5], npc: 'tu',
      waves: { rate: 1.0, grow: 1.0, cap: 120, mix: [['pumpkin', 10, 0], ['ngdisc', 4, 15], ['bat', 3, 45]], horde: 50, hordeN: 16 } },
    { name: '品管室與 CNC 區', sub: '拿到車鑰匙，準備開車去尾牙', story: 'l2', wait: 10, skin: 'f',
      rooms: ['nurse lab hall class', 'lab hall class nurse', 'class nurse lab hall', 'hall lab hall class'],
      ladders: [[0, 3.5], [1, 0.5], [1, 2.5], [2, 3.5]],
      items: [['caliper', 3, 0.5], ['key', 1, 3.5], ['toolbox', 2, 0.5]], chests: [[2, 2.5], [3, 3.5]],
      start: [0, 0.5], exit: [0, 0.5], npc: 'tu',
      waves: { rate: 1.6, grow: 1.6, cap: 170, mix: [['pumpkin', 10, 0], ['ngdisc', 4, 0], ['bat', 4, 20], ['ghost', 3, 40], ['ngwheel', 3, 30], ['mummy', 2, 70]], horde: 42, hordeN: 28 } },
    { name: '食材倉庫與包廂', sub: '米糕怪很耐打', story: 'l3', wait: 10,
      rooms: ['library music hall library class', 'music hall library class music', 'hall class music hall library', 'class library hall music hall'],
      ladders: [[0, 0.5], [0, 4.5], [1, 2.5], [2, 0.5], [2, 4.5]],
      items: [['cape', 3, 4.5], ['camera', 2, 2.5], ['radio', 1, 0.5]], chests: [[1, 3.5], [3, 1.5]],
      start: [0, 2.5], exit: [0, 2.5], npc: 'zhang',
      waves: { rate: 2.3, grow: 2.2, cap: 190, mix: [['pumpkin', 10, 0], ['bat', 4, 0], ['ghost', 3, 30], ['mummy', 2, 60]], horde: 40, hordeN: 34 } },
    { name: '櫃台那一棟', sub: '怪越來越多', story: 'l4', wait: 10,
      rooms: ['office hall class lab library', 'class music hall library hall', 'hall lab class hall nurse', 'library hall nurse class music', 'hall class gym hall lab'],
      ladders: [[0, 0.5], [0, 4.5], [1, 2.5], [2, 0.5], [2, 4.5], [3, 2.5]],
      items: [['lolli', 1, 4.5], ['cookie', 3, 0.5], ['lights', 2, 2.5]], chests: [[1, 0.5], [3, 3.5], [4, 4.5]],
      start: [0, 2.5], exit: [4, 0.5], npc: 'zhang',
      waves: { rate: 2.7, grow: 2.5, cap: 210, mix: [['pumpkin', 10, 0], ['bat', 5, 0], ['ghost', 4, 20], ['mummy', 3, 45]], horde: 38, hordeN: 40 } },
    { name: '頂樓露台尾牙', sub: '大龍蝦王出現了', story: 'l5', wait: 10, boss: { k: 'boss', at: 'roof' },
      rooms: ['roof roof roof roof roof', 'class hall music library hall', 'lab class hall office class', 'hall library class nurse music', 'gym hall lab hall class'],
      ladders: [[0, 2.5], [1, 0.5], [1, 4.5], [2, 2.5], [3, 0.5], [3, 4.5]],
      items: [['banner', 3, 2.5], ['ears', 2, 0.5], ['trophy', 1, 4.5]], chests: [[1, 2.5], [2, 4.5], [3, 1.5]],
      start: [0, 0.5], exit: [4, 2.5], npc: 'both',
      waves: { rate: 3.0, grow: 2.8, cap: 220, mix: [['pumpkin', 10, 0], ['bat', 5, 0], ['ghost', 4, 0], ['mummy', 4, 30]], horde: 36, hordeN: 46 } },
  ];

  // 劇情：每關開場 intro、過關 outro；who: bian 小六、tu 總務阿兔、zhang 老闆
  const STORY = {
    l1: {
      intro: [['tu', '小六～今天是六和尾牙！不過下班前，老闆在會議室還有事要交辦。'], ['bian', '我可以吃尾牙了嗎？'], ['tu', '還不行喔！先把公文夾、印章跟圖面捲送去會議室給我。'], ['tu', '每一關的任務都完成，才能去海豐餐廳吃尾牙～'], ['bian', '……好，送完就可以吃了吧？'], ['tu', '可是組裝區好像跑出好多毛邊怪，加油～']],
      outro: [['tu', '公文接得好！老闆開會就是要這種反應。'], ['bian', '那我可以吃尾牙了嗎？'], ['tu', '還不行喔，下一件事在品管室～']] },
    l2: {
      intro: [['tu', '品管室的卡尺、公司車鑰匙跟工具箱，拿過來之後，我們要開車去海豐餐廳！'], ['bian', '總務，這些不是妳自己拿比較快嗎？'], ['tu', '人家拿不動嘛～鐵塊怪很耐打，小心喔。'], ['tu', '對了！離開公司時下班要記得刷卡，不然會被記曠工喔～'], ['bian', '收到，刷完卡就出發！']],
      outro: [['tu', '車開得真快！我們到海豐餐廳了～'], ['bian', '我可以吃尾牙了嗎？'], ['tu', '快了快了，老闆已經在裡面等了。']] },
    l3: {
      intro: [['zhang', '歡迎來到海豐餐廳！各位同仁，老闆說幾句話就好。'], ['bian', '我可以吃尾牙了嗎？'], ['zhang', '先把摸彩獎品袋、大合照相機、音響搬進來，老闆年紀大了搬不動。'], ['bian', '老闆，您剛剛自己走進來的。'], ['zhang', '……那個，米糕怪很耐打，小心喔。']],
      outro: [['zhang', '搶紅包手速不錯！'], ['bian', '老闆，我可以吃尾牙了嗎？'], ['zhang', '還沒，老闆再說幾句話就好……']] },
    l4: {
      intro: [['zhang', '尾牙的紅包跟年糕，老闆請餐廳收在櫃台那一棟。'], ['zhang', '還有布置用的燈串，在三樓。拿齊了就上五樓櫃台找老闆，要跟同事來場猜拳大賽！'], ['bian', '為什麼紅包收在櫃台？'], ['zhang', '……老闆說幾句話就好，快去快回。']],
      outro: [['zhang', '猜拳贏得漂亮，同事都服氣了！老闆也笑開懷！'], ['bian', '那我可以吃尾牙了嗎？'], ['tu', '最後一項挑戰是逐桌敬酒，每一桌都要敬到喔～']] },
    l5: {
      intro: [['tu', '尾牙布條、財神帽，還有特獎大紅包，拿上來就能開席了！'], ['zhang', '露台上好像有隻很大的龍蝦，老闆覺得不太對勁……'], ['bian', '那隻龍蝦戴著皇冠。'], ['tu', '小六加油！打倒大龍蝦王，我們在露台等你～']],
      outro: [['tu', '每一桌都敬完了，還站得穩！所有挑戰全部通過，尾牙正式開席～'], ['zhang', '各位同仁，老闆說幾句話就好——'], ['bian', '老闆，我可以吃尾牙了嗎？'], ['zhang', '開動！']] },
  };

  const NAMES = { bian: '小六', tu: '總務阿兔', zhang: '老闆' };

  G.DATA = { applySkin, get skin() { return DATA_SKIN.skin; }, CHEST_ICON_F: 206, ROOM, PLAYER, needXp, MONS, SKILLS, MAXLV, HARD, EASY, MAXW, RARE, HERO_LINES, ITEMS, CHEST_ICON, LEVELS, STORY, NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
