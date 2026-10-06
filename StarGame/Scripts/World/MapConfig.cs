using UnityEngine;

namespace StarGame
{
    // マップの形を決めるデータ（ScriptableObject）。数値はUnityのインスペクターで変えられる。
    // ゲームモード（15/30/45/60分）ごとの広さは Phase 6 でモードのデータから決めるようにする。
    //   15分モード：一辺20m ／ 30分：28m ／ 45分：35m ／ 60分：40m（Web版の「以前の計画サイズ×2/3」と同じ）
    [CreateAssetMenu(menuName = "StarGame/Map Config", fileName = "MapConfig")]
    public class MapConfig : ScriptableObject
    {
        [Header("部屋")]
        [Tooltip("部屋の一辺の長さ（m）")] public float roomSize = 20f;
        [Tooltip("壁の高さ（m）")] public float wallHeight = 3f;
        [Tooltip("壁の厚さ（m）")] public float wallThickness = 0.5f;
        [Tooltip("手前（南）の壁の高さ。カメラの視界をふさがないように低くする")] public float frontWallHeight = 0.4f;

        [Header("柱")]
        [Tooltip("柱の太さ（m）")] public float pillarSize = 1.6f;
        [Tooltip("柱を並べる間隔の目安（m）")] public float pillarSpacing = 14f;
        [Tooltip("中央のカード残数ボードの周りは、この範囲に柱を置かない（m）")] public float centerClearHalf = 5f;

        [Header("カード残数ボード（中央・北の壁・南の壁の3か所）")]
        public Vector2 centerBoardSize = new Vector2(7f, 3.5f);
        public Vector2 wallBoardSize = new Vector2(3.4f, 1.7f);

        [Header("プレイヤー")]
        public Vector3 playerStart = new Vector3(0f, 0f, 6f);
    }
}
