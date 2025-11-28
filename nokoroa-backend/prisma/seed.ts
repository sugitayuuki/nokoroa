import { PrismaClient, Post } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create 5 test users
  const hashedPassword = await hash('password123', 10);

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

  const users = [user1, user2, user3, user4, user5];

  // Create test posts with images (distributed among users)
  const posts = [
    {
      title: 'Nokoroaへようこそ！',
      content:
        '日本の素晴らしい旅の思い出を共有できる場所へようこそ！北は北海道から南は沖縄まで、みなさんの素敵な体験を共有していきましょう。日本には四季折々の美しさがあり、それぞれの地域に独特の文化と魅力があります。',
      location: '東京駅',
      imageUrl: '/images/posts/city1.jpg',
      tags: ['ようこそ', '日本旅行', 'Nokoroa'],
      isPublic: true,
      authorId: users[0].id,
    },
    {
      title: '富士山からの絶景サンセット',
      content:
        '富士山五合目から見た夕焼けは言葉にできないほど美しかったです。オレンジとピンクのグラデーションが空一面に広がり、雲海に沈む太陽が幻想的でした。日本一の山から見る景色は、まさに一生の思い出になりました。',
      location: '富士山五合目',
      imageUrl: '/images/posts/sunset1.jpg',
      tags: ['富士山', '夕日', '絶景', '雲海'],
      isPublic: true,
      authorId: users[0].id,
    },
    {
      title: '京都の隠れた名所巡り',
      content:
        '観光客があまり訪れない京都の穴場スポットを発見しました。早朝の竹林の小径は誰もいなくて、竹の葉がサラサラと風に揺れる音だけが聞こえる贅沢な時間でした。地元の方に教えてもらった小さな寺院の庭園も見事でした。',
      location: '嵐山竹林の小径',
      imageUrl: '/images/posts/nature1.jpg',
      tags: ['京都', '竹林', '穴場', '寺院'],
      isPublic: true,
      authorId: users[1].id,
    },
    {
      title: '大阪グルメ食い倒れツアー',
      content:
        '道頓堀で本場のたこ焼きとお好み焼きを堪能！外はカリッと中はトロトロのたこ焼きは最高でした。串カツも「二度づけ禁止」のルールを守りながら楽しみました。大阪の人の温かさと活気に元気をもらいました！',
      location: '道頓堀',
      imageUrl: '/images/posts/food1.jpg',
      latitude: 34.6937,
      longitude: 135.5023,
      tags: ['大阪グルメ', 'たこ焼き', '道頓堀', '串カツ'],
      isPublic: true,
      authorId: users[1].id,
    },
    {
      title: '奈良公園の鹿と紅葉散策',
      content:
        '奈良公園で人懐っこい鹿たちと戯れながら、初秋の風情を楽しみました。東大寺の大仏殿の威容に圧倒され、春日大社の朱色の鳥居が美しい紅葉と調和して見事でした。鹿せんべいを持つと、鹿たちがお辞儀をする姿が愛らしかったです。',
      location: '奈良公園',
      imageUrl: '/images/posts/nature1.jpg',
      latitude: 34.6851,
      longitude: 135.8048,
      tags: ['奈良公園', '鹿', '東大寺', '春日大社', '紅葉'],
      isPublic: true,
      authorId: users[2].id,
    },
    {
      title: '箱根温泉と富士山の絶景',
      content:
        '箱根の老舗旅館で露天風呂に浸かりながら富士山を眺める至福のひととき。硫黄の香りが心地よく、登山で疲れた体が芯から温まりました。夕食の懐石料理は地元の食材を使った繊細な味付けで、日本の「おもてなし」を感じました。',
      location: '箱根温泉',
      imageUrl: '/images/posts/mountain1.jpg',
      latitude: 35.2328,
      longitude: 139.1077,
      tags: ['箱根温泉', '露天風呂', '富士山', '旅館', '懐石料理'],
      isPublic: true,
      authorId: users[2].id,
    },
    {
      title: '上野公園の満開の桜',
      content:
        'ついに桜が満開を迎えた上野公園！淡いピンクの花びらが雪のように舞い散る光景は息を呑むほど美しく、桜の木の下でお花見を楽しみました。お弁当を広げて、日本酒を片手に春の訪れを祝う最高の一日でした。',
      location: '上野公園',
      imageUrl: '/images/posts/nature1.jpg',
      latitude: 35.7155,
      longitude: 139.7731,
      tags: ['桜', 'お花見', '春', '上野公園', '満開'],
      isPublic: true,
      authorId: users[3].id,
    },
    {
      title: '熊野古道の神秘的なハイキング',
      content:
        '世界遺産の熊野古道中辺路を歩く巡礼の旅。千年以上の歴史を刻む石畳の道を一歩一歩踏みしめながら、熊野本宮大社へ向かいました。深い森の中に響く鳥のさえずりと、苔むした石仏に心が洗われる神聖な体験でした。',
      location: '熊野古道中辺路',
      imageUrl: '/images/posts/mountain1.jpg',
      latitude: 33.8355,
      longitude: 135.7878,
      tags: ['熊野古道', '巡礼', '世界遺産', '熊野本宮大社', 'ハイキング'],
      isPublic: true,
      authorId: users[3].id,
    },
    {
      title: '築地場外市場の本格寿司体験',
      content:
        '朝5時から築地場外市場で極上の寿司朝食を堪能！大トロ、ウニ、活きのいいアジ...職人さんの手さばきと新鮮なネタの美味しさに感動しました。玉子焼きも甘くてふわふわで、築地ならではの本物の味を体験できました。',
      location: '築地場外市場',
      imageUrl: '/images/posts/food1.jpg',
      latitude: 35.6654,
      longitude: 139.7707,
      tags: ['寿司', '築地', '場外市場', '大トロ', '職人'],
      isPublic: true,
      authorId: users[4].id,
    },
    {
      title: '地獄谷の雪猿温泉',
      content:
        '長野県の地獄谷野猿公苑で、雪の中で温泉に浸かるニホンザルを観察。真っ白な雪景色の中で、気持ちよさそうに湯につかる猿たちの表情が愛らしく、まさに日本の冬の風物詩でした。親子で仲良く温まる姿に心が和みました。',
      location: '地獄谷野猿公苑',
      imageUrl: '/images/posts/nature1.jpg',
      latitude: 36.7328,
      longitude: 138.4622,
      tags: ['雪猿', '地獄谷', '野猿公苑', '温泉', '長野'],
      isPublic: true,
      authorId: users[4].id,
    },
    {
      title: '東京スカイツリーからの絶景パノラマ',
      content:
        '快晴の日に東京スカイツリーの天望デッキへ！関東平野を一望できる360度のパノラマビューは圧巻でした。遠くに富士山のシルエットも見え、東京の街並みの広がりに改めて首都の巨大さを実感。夜景も素晴らしかったです。',
      location: '東京スカイツリー',
      imageUrl: '/images/posts/city1.jpg',
      latitude: 35.7101,
      longitude: 139.8107,
      tags: ['東京スカイツリー', '展望台', '関東平野', '富士山', '夜景'],
      isPublic: true,
      authorId: users[0].id,
    },
    {
      title: '直島のアートと瀬戸内の美',
      content:
        '瀬戸内海に浮かぶアートの島、直島で週末を過ごしました。草間彌生の南瓜、安藤忠雄設計の地中美術館、ベネッセハウスの現代アート...島全体がアートミュージアムのような不思議な空間でした。瀬戸内海の穏やかな海と芸術の融合が素晴らしかったです。',
      location: '直島',
      imageUrl: '/images/posts/architecture1.jpg',
      latitude: 34.4601,
      longitude: 133.9962,
      tags: ['直島', 'アート', '地中美術館', '草間彌生', '瀬戸内海'],
      isPublic: true,
      authorId: users[1].id,
    },
    {
      title: '別府地獄温泉めぐりの旅',
      content:
        '大分県別府の「地獄めぐり」を体験！海地獄の美しいコバルトブルー、血の池地獄の赤い湯、龍巻地獄の間欠泉...それぞれ異なる色と特徴を持つ温泉は自然の驚異でした。砂湯温泉では砂に埋まって汗だくになり、心身ともにデトックスできました。',
      location: '別府温泉',
      imageUrl: '/images/posts/mountain1.jpg',
      latitude: 33.2795,
      longitude: 131.4916,
      tags: ['別府温泉', '地獄めぐり', '海地獄', '砂湯', '大分'],
      isPublic: true,
      authorId: users[2].id,
    },
    {
      title: '渋谷の夜景とスクランブル交差点',
      content:
        '東京の夜の象徴、渋谷スクランブル交差点で写真撮影！色とりどりのネオンサインが夜空を彩り、人々が行き交う様子はまさに東京の躍動感そのもの。ハチ公前の人混みや109の光る看板など、都市の活気あふれる一瞬を切り取りました。',
      location: '渋谷スクランブル交差点',
      imageUrl: '/images/posts/city1.jpg',
      latitude: 35.6598,
      longitude: 139.7006,
      tags: ['渋谷', 'スクランブル交差点', 'ハチ公', 'ネオン', '夜景撮影'],
      isPublic: true,
      authorId: users[3].id,
    },
    {
      title: '早朝の金閣寺と鏡湖池の絶景',
      content:
        '人が少ない早朝6時に金閣寺を訪問。朝日に照らされた金箔の輝きが鏡湖池に映り込み、まるで絵画のような美しさでした。静寂に包まれた庭園で、足利義満の美意識と日本建築の粋を心ゆくまで堪能できた贅沢な時間でした。',
      location: '金閣寺',
      imageUrl: '/images/posts/architecture1.jpg',
      latitude: 35.0394,
      longitude: 135.7292,
      tags: ['金閣寺', '鏡湖池', '足利義満', '早朝', '京都'],
      isPublic: true,
      authorId: users[4].id,
    },
    {
      title: '祇園祭の山鉾巡行と京都の夏',
      content:
        '7月の祇園祭で山鉾巡行を間近で見ることができました！長刀鉾を先頭に、華麗な装飾を施した山鉾が四条通を練り歩く様子は圧巻。コンチキチンの祭囃子と「エンヤラヤー」の掛け声に、千年の都の夏の風情を感じました。',
      location: '祇園',
      imageUrl: '/images/posts/festival1.jpg',
      latitude: 35.0021,
      longitude: 135.7751,
      tags: ['祇園祭', '山鉾巡行', '長刀鉾', '祭囃子', '京都'],
      isPublic: true,
      authorId: users[0].id,
    },
    {
      title: '沖縄美ら海と白い砂浜の楽園',
      content:
        '沖縄本島の万座毛で見た透明度抜群のエメラルドグリーンの海！真っ白な砂浜でゆったりと過ごし、シーサーが見守る島時間を満喫しました。ゴーヤチャンプルーとオリオンビールで乾杯し、本土では味わえない南国の開放感を堪能。',
      location: '万座毛',
      imageUrl: '/images/posts/beach1.jpg',
      latitude: 26.2124,
      longitude: 127.6792,
      tags: [
        '沖縄',
        '万座毛',
        'エメラルドグリーン',
        'シーサー',
        'オリオンビール',
      ],
      isPublic: true,
      authorId: users[1].id,
    },
    {
      title: '東京下町の隠れ家カフェ巡り',
      content:
        '雨の日の午後、谷根千エリアの古民家カフェを巡りました。昭和レトロな雰囲気の「喫茶店」では自家焙煎コーヒーの香りに包まれ、手作りケーキと一緒にほっと一息。地元の常連さんとの会話も楽しく、東京の下町情緒を満喫できました。',
      location: '谷根千',
      imageUrl: '/images/posts/cafe1.jpg',
      latitude: 35.6762,
      longitude: 139.6503,
      tags: ['谷根千', '古民家カフェ', '自家焙煎', '昭和レトロ', '下町'],
      isPublic: true,
      authorId: users[2].id,
    },
  ];

  const createdPosts: Post[] = [];
  for (const post of posts) {
    const createdPost = await prisma.post.create({
      data: post,
    });
    createdPosts.push(createdPost);
  }

  // Create some sample bookmarks (distributed among all users)
  const bookmarkRelations = [
    { userId: users[0].id, postId: createdPosts[2].id },
    { userId: users[0].id, postId: createdPosts[3].id },
    { userId: users[0].id, postId: createdPosts[6].id },
    { userId: users[1].id, postId: createdPosts[0].id },
    { userId: users[1].id, postId: createdPosts[1].id },
    { userId: users[1].id, postId: createdPosts[4].id },
    { userId: users[2].id, postId: createdPosts[7].id },
    { userId: users[2].id, postId: createdPosts[10].id },
    { userId: users[3].id, postId: createdPosts[11].id },
    { userId: users[3].id, postId: createdPosts[13].id },
    { userId: users[4].id, postId: createdPosts[15].id },
    { userId: users[4].id, postId: createdPosts[16].id },
  ];

  for (const bookmark of bookmarkRelations) {
    await prisma.bookmark.create({
      data: bookmark,
    });
  }

  console.log('Database seeded successfully!');
  console.log(`Created 5 users`);
  console.log(`Created ${createdPosts.length} posts`);
  console.log(`Created ${bookmarkRelations.length} bookmark relations`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
