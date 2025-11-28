const tagColors = [
  '#2196F3', // ブルー
  '#4CAF50', // グリーン
  '#FF9800', // オレンジ
  '#F44336', // レッド
  '#00BCD4', // シアン
  '#9C27B0', // パープル
  '#FFC107', // アンバー
  '#009688', // ティール
  '#E91E63', // ピンク
  '#795548', // ブラウン
  '#607D8B', // ブルーグレー
  '#3F51B5', // インディゴ
  '#8BC34A', // ライトグリーン
  '#FF5722', // ディープオレンジ
  '#673AB7', // ディープパープル
  '#CDDC39', // ライム
];

export const getTagColor = (tag: string): string => {
  // タグ名に基づいて一貫した色を生成
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    const char = tag.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % tagColors.length;
  return tagColors[index];
};
