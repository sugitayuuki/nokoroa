import { Post, PrismaClient, User } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  // 投稿・ブックマーク・フォローは upsert ではなく作成なので、二度流すと
  // 投稿がそのまま倍に増える(その後ブックマークの unique 制約で途中失敗する)。
  // 本番の seed は ECS の run-task で叩くため再実行は容易に起きる。既に中身が
  // あるなら何もせずに正常終了し、意図した再投入だけを SEED_FORCE で通す。
  const existingPosts = await prisma.post.count();
  if (existingPosts > 0 && process.env.SEED_FORCE !== '1') {
    console.log(
      `投稿が既に ${existingPosts} 件あるため seed を中止しました。` +
        '重複を承知で追加する場合は SEED_FORCE=1 を付けてください' +
        '(入れ直したい場合は空の DB から始めてください)。',
    );
    return;
  }

  const hashedPassword = await hash('password123', 10);

  // Create 5 test users
  const user1 = await prisma.user.upsert({
    where: { email: 'michael@example.com' },
    update: {},
    create: {
      email: 'michael@example.com',
      name: 'マイケル',
      password: hashedPassword,
      bio: 'アメリカから来た英語教師です。日本の伝統文化に魅了されて、もう5年も日本に住んでいます。週末は神社仏閣を巡ったり、日本の美しい風景を写真に収めることが趣味です。最近は茶道も習い始めました。',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'james@example.com' },
    update: {},
    create: {
      email: 'james@example.com',
      name: 'ジェームズ',
      password: hashedPassword,
      bio: 'イギリス出身のソフトウェアエンジニアです。東京のテック企業で働きながら、日本の山々を登るのが大好きです。富士山には既に3回登頂しました！日本の温泉文化も素晴らしく、各地の秘湯を巡っています。',
      avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'pierre@example.com' },
    update: {},
    create: {
      email: 'pierre@example.com',
      name: 'ピエール',
      password: hashedPassword,
      bio: 'フランスから来たシェフです。東京の有名レストランで働いた後、日本料理の奥深さに感動し、今は和食の修行中です。フレンチと和食の融合料理を作るのが夢で、日本各地の食材を求めて旅をしています。',
      avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    },
  });

  const user4 = await prisma.user.upsert({
    where: { email: 'david@example.com' },
    update: {},
    create: {
      email: 'david@example.com',
      name: 'デイビッド',
      password: hashedPassword,
      bio: 'カナダ出身の建築家です。日本の伝統建築に感銘を受けて来日しました。木造建築の美しさと機能性に魅了され、宮大工の技術を学んでいます。現代建築と伝統建築の融合を目指して日々研究しています。',
      avatar: 'https://randomuser.me/api/portraits/men/78.jpg',
    },
  });

  const user5 = await prisma.user.upsert({
    where: { email: 'alex@example.com' },
    update: {},
    create: {
      email: 'alex@example.com',
      name: 'アレックス',
      password: hashedPassword,
      bio: 'ドイツから来た日本学研究者です。東京の大学で日本史を研究しています。特に江戸時代の文化に興味があり、浮世絵や歌舞伎について学んでいます。休日は古い街並みが残る場所を巡り、日本の歴史を肌で感じています。',
      avatar: 'https://randomuser.me/api/portraits/men/91.jpg',
    },
  });

  const users: User[] = [user1, user2, user3, user4, user5];

  // Create locations
  const locations = await Promise.all([
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '東京駅',
          latitude: 35.6812,
          longitude: 139.7671,
        },
      },
      update: {},
      create: {
        name: '東京駅',
        prefecture: '東京都',
        latitude: 35.6812,
        longitude: 139.7671,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '富士山五合目',
          latitude: 35.3606,
          longitude: 138.7274,
        },
      },
      update: {},
      create: {
        name: '富士山五合目',
        prefecture: '静岡県',
        latitude: 35.3606,
        longitude: 138.7274,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '嵐山竹林の小径',
          latitude: 35.0094,
          longitude: 135.6722,
        },
      },
      update: {},
      create: {
        name: '嵐山竹林の小径',
        prefecture: '京都府',
        latitude: 35.0094,
        longitude: 135.6722,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '道頓堀',
          latitude: 34.6687,
          longitude: 135.5013,
        },
      },
      update: {},
      create: {
        name: '道頓堀',
        prefecture: '大阪府',
        latitude: 34.6687,
        longitude: 135.5013,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '奈良公園',
          latitude: 34.6851,
          longitude: 135.8048,
        },
      },
      update: {},
      create: {
        name: '奈良公園',
        prefecture: '奈良県',
        latitude: 34.6851,
        longitude: 135.8048,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '箱根温泉',
          latitude: 35.2328,
          longitude: 139.1077,
        },
      },
      update: {},
      create: {
        name: '箱根温泉',
        prefecture: '神奈川県',
        latitude: 35.2328,
        longitude: 139.1077,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '上野公園',
          latitude: 35.7155,
          longitude: 139.7731,
        },
      },
      update: {},
      create: {
        name: '上野公園',
        prefecture: '東京都',
        latitude: 35.7155,
        longitude: 139.7731,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '熊野古道中辺路',
          latitude: 33.8355,
          longitude: 135.7878,
        },
      },
      update: {},
      create: {
        name: '熊野古道中辺路',
        prefecture: '和歌山県',
        latitude: 33.8355,
        longitude: 135.7878,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '築地場外市場',
          latitude: 35.6654,
          longitude: 139.7707,
        },
      },
      update: {},
      create: {
        name: '築地場外市場',
        prefecture: '東京都',
        latitude: 35.6654,
        longitude: 139.7707,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '地獄谷野猿公苑',
          latitude: 36.7328,
          longitude: 138.4622,
        },
      },
      update: {},
      create: {
        name: '地獄谷野猿公苑',
        prefecture: '長野県',
        latitude: 36.7328,
        longitude: 138.4622,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '東京スカイツリー',
          latitude: 35.7101,
          longitude: 139.8107,
        },
      },
      update: {},
      create: {
        name: '東京スカイツリー',
        prefecture: '東京都',
        latitude: 35.7101,
        longitude: 139.8107,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '直島',
          latitude: 34.4601,
          longitude: 133.9962,
        },
      },
      update: {},
      create: {
        name: '直島',
        prefecture: '香川県',
        latitude: 34.4601,
        longitude: 133.9962,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '別府温泉',
          latitude: 33.2795,
          longitude: 131.4916,
        },
      },
      update: {},
      create: {
        name: '別府温泉',
        prefecture: '大分県',
        latitude: 33.2795,
        longitude: 131.4916,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '渋谷スクランブル交差点',
          latitude: 35.6598,
          longitude: 139.7006,
        },
      },
      update: {},
      create: {
        name: '渋谷スクランブル交差点',
        prefecture: '東京都',
        latitude: 35.6598,
        longitude: 139.7006,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '金閣寺',
          latitude: 35.0394,
          longitude: 135.7292,
        },
      },
      update: {},
      create: {
        name: '金閣寺',
        prefecture: '京都府',
        latitude: 35.0394,
        longitude: 135.7292,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '祇園',
          latitude: 35.0021,
          longitude: 135.7751,
        },
      },
      update: {},
      create: {
        name: '祇園',
        prefecture: '京都府',
        latitude: 35.0021,
        longitude: 135.7751,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '万座毛',
          latitude: 26.5044,
          longitude: 127.8556,
        },
      },
      update: {},
      create: {
        name: '万座毛',
        prefecture: '沖縄県',
        latitude: 26.5044,
        longitude: 127.8556,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '谷根千',
          latitude: 35.7262,
          longitude: 139.7673,
        },
      },
      update: {},
      create: {
        name: '谷根千',
        prefecture: '東京都',
        latitude: 35.7262,
        longitude: 139.7673,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '白川郷',
          latitude: 36.2583,
          longitude: 136.9061,
        },
      },
      update: {},
      create: {
        name: '白川郷',
        prefecture: '岐阜県',
        latitude: 36.2583,
        longitude: 136.9061,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '小樽運河',
          latitude: 43.199,
          longitude: 140.9944,
        },
      },
      update: {},
      create: {
        name: '小樽運河',
        prefecture: '北海道',
        latitude: 43.199,
        longitude: 140.9944,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '美瑛の丘',
          latitude: 43.5883,
          longitude: 142.4667,
        },
      },
      update: {},
      create: {
        name: '美瑛の丘',
        prefecture: '北海道',
        latitude: 43.5883,
        longitude: 142.4667,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '厳島神社',
          latitude: 34.2959,
          longitude: 132.3197,
        },
      },
      update: {},
      create: {
        name: '厳島神社',
        prefecture: '広島県',
        latitude: 34.2959,
        longitude: 132.3197,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: 'ひがし茶屋街',
          latitude: 36.5721,
          longitude: 136.6666,
        },
      },
      update: {},
      create: {
        name: 'ひがし茶屋街',
        prefecture: '石川県',
        latitude: 36.5721,
        longitude: 136.6666,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '日光東照宮',
          latitude: 36.758,
          longitude: 139.5988,
        },
      },
      update: {},
      create: {
        name: '日光東照宮',
        prefecture: '栃木県',
        latitude: 36.758,
        longitude: 139.5988,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '鎌倉高校前駅',
          latitude: 35.3083,
          longitude: 139.489,
        },
      },
      update: {},
      create: {
        name: '鎌倉高校前駅',
        prefecture: '神奈川県',
        latitude: 35.3083,
        longitude: 139.489,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '角島大橋',
          latitude: 34.3539,
          longitude: 130.8826,
        },
      },
      update: {},
      create: {
        name: '角島大橋',
        prefecture: '山口県',
        latitude: 34.3539,
        longitude: 130.8826,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '蔵王樹氷原',
          latitude: 38.174,
          longitude: 140.442,
        },
      },
      update: {},
      create: {
        name: '蔵王樹氷原',
        prefecture: '山形県',
        latitude: 38.174,
        longitude: 140.442,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '伏見稲荷大社',
          latitude: 34.9671,
          longitude: 135.7727,
        },
      },
      update: {},
      create: {
        name: '伏見稲荷大社',
        prefecture: '京都府',
        latitude: 34.9671,
        longitude: 135.7727,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '白谷雲水峡',
          latitude: 30.3617,
          longitude: 130.5422,
        },
      },
      update: {},
      create: {
        name: '白谷雲水峡',
        prefecture: '鹿児島県',
        latitude: 30.3617,
        longitude: 130.5422,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '高山陣屋',
          latitude: 36.1395,
          longitude: 137.2546,
        },
      },
      update: {},
      create: {
        name: '高山陣屋',
        prefecture: '岐阜県',
        latitude: 36.1395,
        longitude: 137.2546,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '青森ねぶた祭',
          latitude: 40.8276,
          longitude: 140.734,
        },
      },
      update: {},
      create: {
        name: '青森ねぶた祭',
        prefecture: '青森県',
        latitude: 40.8276,
        longitude: 140.734,
      },
    }),
    prisma.location.upsert({
      where: {
        name_latitude_longitude: {
          name: '草津温泉湯畑',
          latitude: 36.622,
          longitude: 138.5967,
        },
      },
      update: {},
      create: {
        name: '草津温泉湯畑',
        prefecture: '群馬県',
        latitude: 36.622,
        longitude: 138.5967,
      },
    }),
  ]);

  // Create tags
  const tagNames = [
    'ようこそ',
    '日本旅行',
    'Nokoroa',
    '富士山',
    '夕日',
    '絶景',
    '雲海',
    '京都',
    '竹林',
    '穴場',
    '寺院',
    '大阪グルメ',
    'たこ焼き',
    '道頓堀',
    '串カツ',
    '奈良公園',
    '鹿',
    '東大寺',
    '春日大社',
    '紅葉',
    '箱根温泉',
    '露天風呂',
    '旅館',
    '懐石料理',
    '桜',
    'お花見',
    '春',
    '上野公園',
    '満開',
    '熊野古道',
    '巡礼',
    '世界遺産',
    '熊野本宮大社',
    'ハイキング',
    '寿司',
    '築地',
    '場外市場',
    '大トロ',
    '職人',
    '雪猿',
    '地獄谷',
    '野猿公苑',
    '温泉',
    '長野',
    '東京スカイツリー',
    '展望台',
    '関東平野',
    '夜景',
    '直島',
    'アート',
    '地中美術館',
    '草間彌生',
    '瀬戸内海',
    '別府温泉',
    '地獄めぐり',
    '海地獄',
    '砂湯',
    '大分',
    '渋谷',
    'スクランブル交差点',
    'ハチ公',
    'ネオン',
    '夜景撮影',
    '金閣寺',
    '鏡湖池',
    '足利義満',
    '早朝',
    '祇園祭',
    '山鉾巡行',
    '長刀鉾',
    '祭囃子',
    '沖縄',
    '万座毛',
    'エメラルドグリーン',
    'シーサー',
    'オリオンビール',
    '谷根千',
    '古民家カフェ',
    '自家焙煎',
    '昭和レトロ',
    '下町',
    '白川郷',
    '合掌造り',
    '木造建築',
    '古民家',
    '厳島神社',
    '宮島',
    '大鳥居',
    '潮位',
    '出汁',
    '本枯節',
    '昆布',
    '和食修行',
    '美瑛',
    '北海道',
    '丘',
    '写真',
    'パッチワークの路',
    '金沢',
    'ひがし茶屋街',
    '紅殻格子',
    '江戸',
    '町並み保存',
    '日光東照宮',
    '陽明門',
    '彫刻',
    '権現造り',
    '栃木',
    'ジャガイモ',
    'チーズ',
    '生産者',
    '小樽',
    '運河',
    '明治',
    '倉庫街',
    'ガス灯',
    '伏見稲荷大社',
    '千本鳥居',
    '稲荷山',
    '屋久島',
    '白谷雲水峡',
    '苔',
    'トレッキング',
    '原生林',
    '高山陣屋',
    '飛騨高山',
    '代官所',
    '岐阜',
    'シャコ',
    'ホッキ貝',
    'カウンター',
    '江ノ電',
    '鎌倉高校前',
    '踏切',
    '湘南',
    '夕景',
    '角島大橋',
    '山口',
    'ドライブ',
    '蔵王',
    '樹氷',
    'スノーモンスター',
    '冬山',
    '山形',
    '青森ねぶた祭',
    'ハネト',
    'ラッセラー',
    '東北',
    '夏祭り',
    '草津温泉',
    '湯畑',
    '湯もみ',
    '源泉かけ流し',
    '群馬',
    '和菓子',
    '生菓子',
    '抹茶',
    '日光',
    '中禅寺湖',
    'いろは坂',
    '避暑地',
    '箱根',
    '数寄屋',
    '旅館建築',
    '床柱',
    '和室',
    '再開発',
    '東京',
    '伏見稲荷',
    '食べ歩き',
    'いなり寿司',
    '門前',
    '京都グルメ',
  ];

  const tags: { [key: string]: { id: number } } = {};
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) || name.toLowerCase() },
    });
    tags[name] = tag;
  }

  // Post data with location and tag references
  const postsData = [
    {
      title: '京都の隠れた名所巡り',
      content:
        '観光客があまり訪れない京都の穴場スポットを発見しました。早朝の竹林の小径は誰もいなくて、竹の葉がサラサラと風に揺れる音だけが聞こえる贅沢な時間でした。地元の方に教えてもらった小さな寺院の庭園も見事でした。',
      imageUrl: '/images/posts/nature1.jpg',
      createdAt: new Date('2026-10-08T08:00:00+09:00'),
      locationId: locations[2].id,
      authorId: users[1].id,
      tags: ['京都', '竹林', '穴場', '寺院'],
    },
    {
      title: '直島のアートと瀬戸内の美',
      content:
        '瀬戸内海に浮かぶアートの島、直島で週末を過ごしました。草間彌生の南瓜、安藤忠雄設計の地中美術館、ベネッセハウスの現代アート...島全体がアートミュージアムのような不思議な空間でした。瀬戸内海の穏やかな海と芸術の融合が素晴らしかったです。',
      imageUrl: '/images/posts/architecture1.jpg',
      createdAt: new Date('2026-10-01T11:17:00+09:00'),
      locationId: locations[11].id,
      authorId: users[1].id,
      tags: ['直島', 'アート', '地中美術館', '草間彌生', '瀬戸内海'],
    },
    {
      title: '大阪グルメ食い倒れツアー',
      content:
        '道頓堀で本場のたこ焼きとお好み焼きを堪能！外はカリッと中はトロトロのたこ焼きは最高でした。串カツも「二度づけ禁止」のルールを守りながら楽しみました。大阪の人の温かさと活気に元気をもらいました！',
      imageUrl: '/images/posts/food1.jpg',
      createdAt: new Date('2026-09-22T14:34:00+09:00'),
      locationId: locations[3].id,
      authorId: users[1].id,
      tags: ['大阪グルメ', 'たこ焼き', '道頓堀', '串カツ'],
    },
    {
      title: '奈良公園の鹿と紅葉散策',
      content:
        '奈良公園で人懐っこい鹿たちと戯れながら、初秋の風情を楽しみました。東大寺の大仏殿の威容に圧倒され、春日大社の朱色の鳥居が美しい紅葉と調和して見事でした。鹿せんべいを持つと、鹿たちがお辞儀をする姿が愛らしかったです。',
      imageUrl: '/images/posts/nature1.jpg',
      createdAt: new Date('2026-09-10T17:51:00+09:00'),
      locationId: locations[4].id,
      authorId: users[2].id,
      tags: ['奈良公園', '鹿', '東大寺', '春日大社', '紅葉'],
    },
    {
      title: '早朝の金閣寺と鏡湖池の絶景',
      content:
        '人が少ない早朝6時に金閣寺を訪問。朝日に照らされた金箔の輝きが鏡湖池に映り込み、まるで絵画のような美しさでした。静寂に包まれた庭園で、足利義満の美意識と日本建築の粋を心ゆくまで堪能できた贅沢な時間でした。',
      imageUrl: '/images/posts/architecture1.jpg',
      createdAt: new Date('2026-09-02T08:08:00+09:00'),
      locationId: locations[14].id,
      authorId: users[4].id,
      tags: ['金閣寺', '鏡湖池', '足利義満', '早朝', '京都'],
    },
    {
      title: 'Nokoroaへようこそ！',
      content:
        '日本の素晴らしい旅の思い出を共有できる場所へようこそ！北は北海道から南は沖縄まで、みなさんの素敵な体験を共有していきましょう。日本には四季折々の美しさがあり、それぞれの地域に独特の文化と魅力があります。',
      imageUrl: '/images/posts/city1.jpg',
      createdAt: new Date('2026-08-22T11:25:00+09:00'),
      locationId: locations[0].id,
      authorId: users[0].id,
      tags: ['ようこそ', '日本旅行', 'Nokoroa'],
    },
    {
      title: '上野公園の満開の桜',
      content:
        'ついに桜が満開を迎えた上野公園！淡いピンクの花びらが雪のように舞い散る光景は息を呑むほど美しく、桜の木の下でお花見を楽しみました。お弁当を広げて、日本酒を片手に春の訪れを祝う最高の一日でした。',
      imageUrl: '/images/posts/nature1.jpg',
      createdAt: new Date('2026-08-12T14:42:00+09:00'),
      locationId: locations[6].id,
      authorId: users[3].id,
      tags: ['桜', 'お花見', '春', '上野公園', '満開'],
    },
    {
      title: '築地場外市場の本格寿司体験',
      content:
        '朝5時から築地場外市場で極上の寿司朝食を堪能！大トロ、ウニ、活きのいいアジ...職人さんの手さばきと新鮮なネタの美味しさに感動しました。玉子焼きも甘くてふわふわで、築地ならではの本物の味を体験できました。',
      imageUrl: '/images/posts/food1.jpg',
      createdAt: new Date('2026-08-06T17:59:00+09:00'),
      locationId: locations[8].id,
      authorId: users[4].id,
      tags: ['寿司', '築地', '場外市場', '大トロ', '職人'],
    },
    {
      title: '合掌造りの屋根裏に上がらせてもらった',
      content:
        '白川郷の集落で、保存民家の屋根裏まで見学できました。釘を一本も使わず縄と木組みだけで組まれた小屋組は、豪雪の重みを受け流すために計算し尽くされています。建築家として何度も図面で見た構造ですが、実物の太い梁を間近で見ると迫力が違いました。',
      imageUrl: '/images/posts/architecture1.jpg',
      createdAt: new Date('2026-07-24T08:16:00+09:00'),
      locationId: locations[18].id,
      authorId: users[3].id,
      tags: ['白川郷', '合掌造り', '世界遺産', '木造建築', '古民家'],
    },
    {
      title: '箱根温泉と富士山の絶景',
      content:
        '箱根の老舗旅館で露天風呂に浸かりながら富士山を眺める至福のひととき。硫黄の香りが心地よく、登山で疲れた体が芯から温まりました。夕食の懐石料理は地元の食材を使った繊細な味付けで、日本の「おもてなし」を感じました。',
      imageUrl: '/images/posts/mountain1.jpg',
      createdAt: new Date('2026-07-17T11:33:00+09:00'),
      locationId: locations[5].id,
      authorId: users[2].id,
      tags: ['箱根温泉', '露天風呂', '富士山', '旅館', '懐石料理'],
    },
    {
      title: '地獄谷の雪猿温泉',
      content:
        '長野県の地獄谷野猿公苑で、雪の中で温泉に浸かるニホンザルを観察。真っ白な雪景色の中で、気持ちよさそうに湯につかる猿たちの表情が愛らしく、まさに日本の冬の風物詩でした。親子で仲良く温まる姿に心が和みました。',
      imageUrl: '/images/posts/nature1.jpg',
      createdAt: new Date('2026-07-08T14:50:00+09:00'),
      locationId: locations[9].id,
      authorId: users[4].id,
      tags: ['雪猿', '地獄谷', '野猿公苑', '温泉', '長野'],
    },
    {
      title: '東京スカイツリーからの絶景パノラマ',
      content:
        '快晴の日に東京スカイツリーの天望デッキへ！関東平野を一望できる360度のパノラマビューは圧巻でした。遠くに富士山のシルエットも見え、東京の街並みの広がりに改めて首都の巨大さを実感。夜景も素晴らしかったです。',
      imageUrl: '/images/posts/city1.jpg',
      createdAt: new Date('2026-06-26T17:07:00+09:00'),
      locationId: locations[10].id,
      authorId: users[0].id,
      tags: ['東京スカイツリー', '展望台', '関東平野', '富士山', '夜景'],
    },
    {
      title: '厳島神社、潮が満ちるまで待った三時間',
      content:
        '宮島に渡ったときは干潮で、大鳥居の根元まで歩いて行けました。海中に建つ社殿を見たくて三時間ほど粘り、潮が満ちて回廊の床板すれすれまで水が来た瞬間は鳥肌が立ちました。潮位表を調べてから行くことを強くおすすめします。',
      imageUrl: '/images/posts/architecture1.jpg',
      createdAt: new Date('2026-06-18T08:24:00+09:00'),
      locationId: locations[21].id,
      authorId: users[0].id,
      tags: ['厳島神社', '宮島', '大鳥居', '潮位', '世界遺産'],
    },
    {
      title: '築地で出汁の材料を仕入れる朝',
      content:
        '場外市場の乾物屋で、本枯節と昆布を選んできました。店主に削り方で出汁がどう変わるかを教わり、厚削りと薄削りを両方買って帰って飲み比べ。フランス料理のフォンとは出汁の考え方が根本から違うことを、味で理解できた朝でした。',
      imageUrl: '/images/posts/food1.jpg',
      createdAt: new Date('2026-06-07T11:41:00+09:00'),
      locationId: locations[8].id,
      authorId: users[2].id,
      tags: ['築地', '出汁', '本枯節', '昆布', '和食修行'],
    },
    {
      title: '熊野古道の神秘的なハイキング',
      content:
        '世界遺産の熊野古道中辺路を歩く巡礼の旅。千年以上の歴史を刻む石畳の道を一歩一歩踏みしめながら、熊野本宮大社へ向かいました。深い森の中に響く鳥のさえずりと、苔むした石仏に心が洗われる神聖な体験でした。',
      imageUrl: '/images/posts/mountain1.jpg',
      createdAt: new Date('2026-05-28T14:58:00+09:00'),
      locationId: locations[7].id,
      authorId: users[3].id,
      tags: ['熊野古道', '巡礼', '世界遺産', '熊野本宮大社', 'ハイキング'],
    },
    {
      title: '渋谷の夜景とスクランブル交差点',
      content:
        '東京の夜の象徴、渋谷スクランブル交差点で写真撮影！色とりどりのネオンサインが夜空を彩り、人々が行き交う様子はまさに東京の躍動感そのもの。ハチ公前の人混みや109の光る看板など、都市の活気あふれる一瞬を切り取りました。',
      imageUrl: '/images/posts/city1.jpg',
      createdAt: new Date('2026-05-22T17:15:00+09:00'),
      locationId: locations[13].id,
      authorId: users[3].id,
      tags: ['渋谷', 'スクランブル交差点', 'ハチ公', 'ネオン', '夜景撮影'],
    },
    {
      title: '美瑛の丘、曇りの日こそ撮りどきでした',
      content:
        '美瑛の丘陵地帯をレンタサイクルで回りました。快晴を狙って行ったのですが、結局いちばん良い写真が撮れたのは雲が低く垂れこめた午後でした。畑のうねりと雲の陰影が重なって、彩度の低い色の層が何枚も並んで見えるんです。',
      imageUrl: '/images/posts/nature1.jpg',
      createdAt: new Date('2026-05-09T08:32:00+09:00'),
      locationId: locations[20].id,
      authorId: users[0].id,
      tags: ['美瑛', '北海道', '丘', '写真', 'パッチワークの路'],
    },
    {
      title: 'ひがし茶屋街、朝の光と紅殻格子',
      content:
        '金沢のひがし茶屋街は、観光客が増える前の朝八時が別世界でした。紅殻格子に朝日が当たると、格子の影が石畳に細い縞を落とします。江戸後期に茶屋町として整備された区画がそのまま残っていて、研究対象としても一級の街並みです。',
      imageUrl: '/images/posts/travel1.jpg',
      createdAt: new Date('2026-05-02T11:49:00+09:00'),
      locationId: locations[22].id,
      authorId: users[4].id,
      tags: ['金沢', 'ひがし茶屋街', '紅殻格子', '江戸', '町並み保存'],
    },
    {
      title: '日光東照宮、陽明門の彫刻を数えてみた',
      content:
        '陽明門には五百以上の彫刻があると聞いて、首が痛くなるまで見上げてきました。麒麟、龍、唐獅子が層をなして配置され、どこを切り取っても密度が落ちません。極彩色の下に木組みがきちんとあるのが建築家としては一番の見どころでした。',
      imageUrl: '/images/posts/architecture1.jpg',
      createdAt: new Date('2026-04-23T14:06:00+09:00'),
      locationId: locations[23].id,
      authorId: users[3].id,
      tags: ['日光東照宮', '陽明門', '彫刻', '権現造り', '栃木'],
    },
    {
      title: '北海道の食材は、素材そのものが完成している',
      content:
        '美瑛と富良野の農家を回って、ジャガイモとチーズ、それから搾りたての牛乳をいただきました。男爵とメークインの違いを畑で説明してもらい、その場で蒸かしたものを塩だけで食べる。手を加えないほうが良い食材が本当にあるのだと実感しました。',
      imageUrl: '/images/posts/food1.jpg',
      createdAt: new Date('2026-04-11T17:23:00+09:00'),
      locationId: locations[20].id,
      authorId: users[2].id,
      tags: ['北海道', '美瑛', 'ジャガイモ', 'チーズ', '生産者'],
    },
    {
      title: '富士山からの絶景サンセット',
      content:
        '富士山五合目から見た夕焼けは言葉にできないほど美しかったです。オレンジとピンクのグラデーションが空一面に広がり、雲海に沈む太陽が幻想的でした。日本一の山から見る景色は、まさに一生の思い出になりました。',
      imageUrl: '/images/posts/sunset1.jpg',
      createdAt: new Date('2026-04-03T08:40:00+09:00'),
      locationId: locations[1].id,
      authorId: users[0].id,
      tags: ['富士山', '夕日', '絶景', '雲海'],
    },
    {
      title: '別府地獄温泉めぐりの旅',
      content:
        '大分県別府の「地獄めぐり」を体験！海地獄の美しいコバルトブルー、血の池地獄の赤い湯、龍巻地獄の間欠泉...それぞれ異なる色と特徴を持つ温泉は自然の驚異でした。砂湯温泉では砂に埋まって汗だくになり、心身ともにデトックスできました。',
      imageUrl: '/images/posts/mountain1.jpg',
      createdAt: new Date('2026-03-23T11:57:00+09:00'),
      locationId: locations[12].id,
      authorId: users[2].id,
      tags: ['別府温泉', '地獄めぐり', '海地獄', '砂湯', '大分'],
    },
    {
      title: '祇園祭の山鉾巡行と京都の夏',
      content:
        '7月の祇園祭で山鉾巡行を間近で見ることができました！長刀鉾を先頭に、華麗な装飾を施した山鉾が四条通を練り歩く様子は圧巻。コンチキチンの祭囃子と「エンヤラヤー」の掛け声に、千年の都の夏の風情を感じました。',
      imageUrl: '/images/posts/festival1.jpg',
      createdAt: new Date('2026-03-13T14:14:00+09:00'),
      locationId: locations[15].id,
      authorId: users[0].id,
      tags: ['祇園祭', '山鉾巡行', '長刀鉾', '祭囃子', '京都'],
    },
    {
      title: '沖縄美ら海と白い砂浜の楽園',
      content:
        '沖縄本島の万座毛で見た透明度抜群のエメラルドグリーンの海！真っ白な砂浜でゆったりと過ごし、シーサーが見守る島時間を満喫しました。ゴーヤチャンプルーとオリオンビールで乾杯し、本土では味わえない南国の開放感を堪能。',
      imageUrl: '/images/posts/beach1.jpg',
      createdAt: new Date('2026-03-07T17:31:00+09:00'),
      locationId: locations[16].id,
      authorId: users[1].id,
      tags: [
        '沖縄',
        '万座毛',
        'エメラルドグリーン',
        'シーサー',
        'オリオンビール',
      ],
    },
    {
      title: '東京下町の隠れ家カフェ巡り',
      content:
        '雨の日の午後、谷根千エリアの古民家カフェを巡りました。昭和レトロな雰囲気の「喫茶店」では自家焙煎コーヒーの香りに包まれ、手作りケーキと一緒にほっと一息。地元の常連さんとの会話も楽しく、東京の下町情緒を満喫できました。',
      imageUrl: '/images/posts/cafe1.jpg',
      createdAt: new Date('2026-02-22T08:48:00+09:00'),
      locationId: locations[17].id,
      authorId: users[2].id,
      tags: ['谷根千', '古民家カフェ', '自家焙煎', '昭和レトロ', '下町'],
    },
    {
      title: '小樽運河、倉庫街に残る明治の商いの跡',
      content:
        '小樽運河沿いのガス灯に火が入る時間に歩きました。石造りの倉庫群は明治から大正にかけて北海道の物流を担った建物で、壁に残る商家の印が当時の所有者を今も示しています。観光地として整備されていますが、歴史の層がきちんと見える街でした。',
      imageUrl: '/images/posts/city1.jpg',
      createdAt: new Date('2026-02-15T11:05:00+09:00'),
      locationId: locations[19].id,
      authorId: users[4].id,
      tags: ['小樽', '運河', '明治', '倉庫街', 'ガス灯'],
    },
    {
      title: '伏見稲荷、千本鳥居は早朝に限ります',
      content:
        '朝六時に伏見稲荷へ。千本鳥居は日中だと人が途切れませんが、この時間なら朱色のトンネルを独り占めできます。鳥居の裏側には奉納した人の名前と年月が彫られていて、一本ずつ読みながら登るとあっという間に稲荷山の頂上でした。',
      imageUrl: '/images/posts/travel1.jpg',
      createdAt: new Date('2026-02-06T14:22:00+09:00'),
      locationId: locations[27].id,
      authorId: users[0].id,
      tags: ['伏見稲荷大社', '千本鳥居', '早朝', '稲荷山', '京都'],
    },
    {
      title: '白谷雲水峡、苔が主役の森',
      content:
        '屋久島の白谷雲水峡をトレッキングしました。花崗岩の上に苔が厚く積もり、その上に木が根を張るという独特の森で、六百種を超える苔が確認されているそうです。雨の日のほうが苔は美しいと言われて納得しました。',
      imageUrl: '/images/posts/nature1.jpg',
      createdAt: new Date('2026-01-25T17:39:00+09:00'),
      locationId: locations[28].id,
      authorId: users[1].id,
      tags: ['屋久島', '白谷雲水峡', '苔', 'トレッキング', '原生林'],
    },
    {
      title: '高山陣屋、江戸の役所がそのまま残っている',
      content:
        '飛騨高山の陣屋は、江戸幕府の代官所が現存する唯一の例です。畳の部屋の格式が身分で細かく分かれていて、床の高さと天井の作りだけで誰が座る場所か分かるようになっています。建物が制度の写し絵になっているのが面白い。',
      imageUrl: '/images/posts/architecture1.jpg',
      createdAt: new Date('2026-01-17T08:56:00+09:00'),
      locationId: locations[29].id,
      authorId: users[3].id,
      tags: ['高山陣屋', '飛騨高山', '代官所', '江戸', '岐阜'],
    },
    {
      title: '小樽の寿司屋通りで、昼から一人カウンター',
      content:
        '小樽には寿司屋が集まる通りがあり、昼から開いている店も多い。地元の魚を中心に握ってもらい、シャコとホッキ貝が特に良かったです。東京の寿司とはネタの構成がはっきり違って、港町ごとの個性があることがよく分かりました。',
      imageUrl: '/images/posts/food1.jpg',
      createdAt: new Date('2026-01-06T11:13:00+09:00'),
      locationId: locations[19].id,
      authorId: users[2].id,
      tags: ['小樽', '寿司', 'シャコ', 'ホッキ貝', 'カウンター'],
    },
    {
      title: '鎌倉高校前の踏切で、夕方の江ノ電を待つ',
      content:
        '海沿いを走る江ノ電を撮りたくて、鎌倉高校前駅の踏切で一時間ほど粘りました。西日が線路と海を同時に照らす時間帯は十五分ほどしかなく、その中で電車が来るのは二本だけ。撮れた一枚は今でも待ち受けにしています。',
      imageUrl: '/images/posts/sunset1.jpg',
      createdAt: new Date('2025-12-27T14:30:00+09:00'),
      locationId: locations[24].id,
      authorId: users[0].id,
      tags: ['江ノ電', '鎌倉高校前', '踏切', '湘南', '夕景'],
    },
    {
      title: '角島大橋、本州の端にある青',
      content:
        '山口県の北西端まで車を走らせました。角島大橋は全長一七八〇メートル、無料で渡れる橋としては日本有数の長さです。晴れた日の海の色は南国のそれで、本州にこんな青があるとは思っていませんでした。',
      imageUrl: '/images/posts/beach1.jpg',
      createdAt: new Date('2025-12-21T17:47:00+09:00'),
      locationId: locations[25].id,
      authorId: users[1].id,
      tags: ['角島大橋', '山口', 'ドライブ', 'エメラルドグリーン', '絶景'],
    },
    {
      title: '蔵王の樹氷原を歩いた、氷点下十五度の世界',
      content:
        'ロープウェイで地蔵山頂駅まで上がると、一面の樹氷原が広がっていました。アオモリトドマツに着氷と雪が交互に積もってできる造形で、二月が見頃だそうです。氷点下十五度、風速十メートル。防寒を甘く見ると十分で引き返すことになります。',
      imageUrl: '/images/posts/mountain1.jpg',
      createdAt: new Date('2025-12-08T08:04:00+09:00'),
      locationId: locations[26].id,
      authorId: users[1].id,
      tags: ['蔵王', '樹氷', 'スノーモンスター', '冬山', '山形'],
    },
    {
      title: 'ねぶた祭、ハネトとして跳ねてきました',
      content:
        '青森ねぶた祭は見るだけでなく参加できると知り、衣装を借りてハネトに加わりました。「ラッセラー」の掛け声に合わせて跳ね続けるのは想像以上の運動量で、三十分でへとへと。巨大なねぶたを下から見上げる光景は一生忘れません。',
      imageUrl: '/images/posts/festival1.jpg',
      createdAt: new Date('2025-12-01T11:21:00+09:00'),
      locationId: locations[30].id,
      authorId: users[4].id,
      tags: ['青森ねぶた祭', 'ハネト', 'ラッセラー', '東北', '夏祭り'],
    },
    {
      title: '草津の湯畑、湯もみは観光用ではなかった',
      content:
        '草津温泉の湯畑は毎分四千リットルの湯が湧き、源泉の温度は五十度を超えます。湯もみは水で薄めずに温度を下げるための実用的な手法で、見世物として始まったものではないと知って見方が変わりました。湯の花が木樋に白く積もっていきます。',
      imageUrl: '/images/posts/travel1.jpg',
      createdAt: new Date('2025-11-22T14:38:00+09:00'),
      locationId: locations[31].id,
      authorId: users[1].id,
      tags: ['草津温泉', '湯畑', '湯もみ', '源泉かけ流し', '群馬'],
    },
    {
      title: '金沢で和菓子屋に弟子入りしかけた話',
      content:
        'ひがし茶屋街の和菓子屋で、季節の生菓子を見せてもらいました。餡の甘さを抑えて素材の香りを立てる設計は、デセールの組み立てとまったく違う発想です。興奮して質問し続けたら「修行する?」と笑われました。本気で考えています。',
      imageUrl: '/images/posts/cafe1.jpg',
      createdAt: new Date('2025-11-10T17:55:00+09:00'),
      locationId: locations[22].id,
      authorId: users[2].id,
      tags: ['金沢', '和菓子', '生菓子', '抹茶', '職人'],
    },
    {
      title: '中禅寺湖の紅葉と、江戸期の避暑地としての日光',
      content:
        'いろは坂を上がって中禅寺湖へ。標高千二百メートルの湖畔は十月中旬が紅葉の盛りでした。日光は江戸期から参詣と避暑の両方で人を集めた土地で、明治以降は各国の大使館別荘が並びます。その重なりが今の景観を作っています。',
      imageUrl: '/images/posts/nature1.jpg',
      createdAt: new Date('2025-11-02T08:12:00+09:00'),
      locationId: locations[23].id,
      authorId: users[4].id,
      tags: ['日光', '中禅寺湖', '紅葉', 'いろは坂', '避暑地'],
    },
    {
      title: '箱根の旅館建築、数寄屋の寸法を測らせてもらった',
      content:
        '泊まった旅館が昭和初期の数寄屋建築で、女将さんに頼んで各部屋を見せてもらいました。床柱の面取り、天井の竿縁の間隔、障子の組子の割り付け。どれも寸法に理由があり、職人が意図を持って決めたことが伝わってきます。',
      imageUrl: '/images/posts/architecture1.jpg',
      createdAt: new Date('2025-10-22T11:29:00+09:00'),
      locationId: locations[5].id,
      authorId: users[3].id,
      tags: ['箱根', '数寄屋', '旅館建築', '床柱', '和室'],
    },
    {
      title: '渋谷の夜、スクランブル交差点を真上から',
      content:
        '再開発で新しくできた展望施設から、スクランブル交差点を真上に近い角度で見下ろしました。信号が変わるたびに人の流れが交差して解けていく様子は、上から見ると完全に流体です。エンジニアとしては一日眺めていられる光景でした。',
      imageUrl: '/images/posts/city1.jpg',
      createdAt: new Date('2025-10-12T14:46:00+09:00'),
      locationId: locations[13].id,
      authorId: users[1].id,
      tags: ['渋谷', 'スクランブル交差点', '夜景', '再開発', '東京'],
    },
    {
      title: '伏見稲荷の参道で食べ歩きだけして帰った日',
      content:
        '参拝もそこそこに、参道の食べ歩きに専念しました。すずめの焼き鳥、いなり寿司、きつねうどん。稲荷神と油揚げの結びつきが食文化としてここまで徹底されているのが面白く、どの店も「稲荷」を軸に品書きを組んでいます。',
      imageUrl: '/images/posts/food1.jpg',
      createdAt: new Date('2025-10-06T17:03:00+09:00'),
      locationId: locations[27].id,
      authorId: users[2].id,
      tags: ['伏見稲荷', '食べ歩き', 'いなり寿司', '門前', '京都グルメ'],
    },
  ];

  // Create posts with tags
  const createdPosts: Post[] = [];
  for (const postData of postsData) {
    const { tags: postTags, ...postFields } = postData;
    const post = await prisma.post.create({
      data: {
        ...postFields,
        isPublic: true,
        postTags: {
          create: postTags.map((tagName) => ({
            tagId: tags[tagName].id,
          })),
        },
      },
    });
    createdPosts.push(post);
  }

  // Create bookmarks
  //
  // 添字を直書きすると、投稿を増やすたびに手で振り直すことになり、
  // 著者を見ていないので「自分の投稿を自分でブックマークした」データも混ざる。
  // 投稿と利用者の組から機械的に作り、自分の投稿だけ除く。
  const bookmarkRelations = createdPosts.flatMap((post, postIndex) =>
    users
      .map((user, userIndex) => ({ user, userIndex }))
      .filter(
        ({ user, userIndex }) =>
          user.id !== post.authorId && (postIndex + userIndex) % 4 === 0,
      )
      .map(({ user }) => ({ userId: user.id, postId: post.id })),
  );

  // SEED_FORCE で二度流したときに unique 制約で落ちないようにする
  // (投稿と違い、こちらは重複を作れないので飛ばすのが正しい)。
  const createdBookmarks = await prisma.bookmark.createMany({
    data: bookmarkRelations,
    skipDuplicates: true,
  });

  // Create follow relationships
  const followRelations = users.flatMap((follower, followerIndex) =>
    users
      .filter((_, followingIndex) => {
        const distance =
          (followingIndex - followerIndex + users.length) % users.length;
        return distance === 1 || distance === 2;
      })
      .map((following) => ({
        followerId: follower.id,
        followingId: following.id,
      })),
  );

  const createdFollows = await prisma.follow.createMany({
    data: followRelations,
    skipDuplicates: true,
  });

  // skipDuplicates があるので、渡した件数ではなく実際に入った件数を出す
  // (SEED_FORCE での再投入時に数が食い違う)。
  console.log('Database seeded successfully!');
  console.log(`Created ${users.length} users`);
  console.log(`Created ${locations.length} locations`);
  console.log(`Created ${Object.keys(tags).length} tags`);
  console.log(`Created ${createdPosts.length} posts`);
  console.log(`Created ${createdBookmarks.count} bookmarks`);
  console.log(`Created ${createdFollows.count} follow relationships`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
