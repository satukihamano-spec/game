using System.Collections.Generic;
using UnityEngine;

namespace StarGame
{
    // MapConfig のデータから、3Dのマップ（床・壁・柱・カード残数ボード）をゲーム開始時に組み立てる。
    // スマホ向けの軽量化：
    //   ・すべて単純な箱（Cube）で作る
    //   ・影を出さない
    //   ・組み立てた後に「静的バッチング」でまとめ、描画の回数を減らす
    public class MapBuilder : MonoBehaviour
    {
        [SerializeField] private MapConfig config;

        [Header("材質（エディターのセットアップで自動で入る）")]
        [SerializeField] private Material floorMaterial;
        [SerializeField] private Material wallMaterial;
        [SerializeField] private Material pillarMaterial;
        [SerializeField] private Material boardMaterial;
        [SerializeField] private Material boardFrameMaterial;

        private Transform root;
        private readonly List<Bounds> obstacles = new List<Bounds>();
        private readonly List<Transform> cardBoards = new List<Transform>();

        public float RoomSize => config.roomSize;
        public Vector3 PlayerStart => config.playerStart;
        // 柱などの障害物（NPCを置く場所を決めるときに使う：Phase 2）
        public IReadOnlyList<Bounds> Obstacles => obstacles;
        // カード残数ボードの表示面（中央・北・南）。Phase 3 で数字を表示する
        public IReadOnlyList<Transform> CardBoards => cardBoards;

        public void Build()
        {
            if (root != null) Destroy(root.gameObject);
            obstacles.Clear();
            cardBoards.Clear();
            root = new GameObject("MapRoot").transform;
            root.SetParent(transform, false);

            var c = config;
            float size = c.roomSize;
            float half = size / 2f;
            float h = c.wallHeight;
            float t = c.wallThickness;

            // 床（タイル模様は材質の繰り返しで表現する）
            var floor = Block("Floor", new Vector3(0f, -0.1f, 0f), new Vector3(size, 0.2f, size), floorMaterial, false);
            var floorRenderer = floor.GetComponent<Renderer>();
            floorRenderer.material.mainTextureScale = new Vector2(size / 2f, size / 2f); // 2mごとに1枚のタイル

            // 壁（奥・手前（低い）・左・右）
            Block("Wall_North", new Vector3(0f, h / 2f, -half - t / 2f), new Vector3(size + t * 2f, h, t), wallMaterial, true);
            Block("Wall_South", new Vector3(0f, c.frontWallHeight / 2f, half + t / 2f), new Vector3(size + t * 2f, c.frontWallHeight, t), wallMaterial, true);
            Block("Wall_West", new Vector3(-half - t / 2f, h / 2f, 0f), new Vector3(t, h, size), wallMaterial, true);
            Block("Wall_East", new Vector3(half + t / 2f, h / 2f, 0f), new Vector3(t, h, size), wallMaterial, true);

            // 柱：だいたい pillarSpacing ごとに並べる（中央のボードの周りは空ける）
            int count = Mathf.Max(2, Mathf.RoundToInt(size / c.pillarSpacing));
            float step = size / count;
            for (int i = 0; i < count; i++)
            {
                for (int j = 0; j < count; j++)
                {
                    float x = -half + step * (i + 0.5f);
                    float z = -half + step * (j + 0.5f);
                    if (Mathf.Abs(x) < c.centerClearHalf && Mathf.Abs(z) < c.centerClearHalf) continue;
                    Block($"Pillar_{i}_{j}", new Vector3(x, h / 2f, z), new Vector3(c.pillarSize, h, c.pillarSize), pillarMaterial, true);
                }
            }

            // カード残数ボード（3か所。Phase 3 で同じ数字を表示する）
            // ① 中央：床に置いた低い台
            var cb = c.centerBoardSize;
            Block("CardBoard_Center_Base", new Vector3(0f, 0.25f, 0f), new Vector3(cb.x, 0.5f, cb.y), boardFrameMaterial, true);
            var centerFace = Block("CardBoard_Center", new Vector3(0f, 0.52f, 0f), new Vector3(cb.x - 0.3f, 0.04f, cb.y - 0.3f), boardMaterial, false);
            cardBoards.Add(centerFace.transform);

            // ② 北の壁の中央
            var wb = c.wallBoardSize;
            float northY = Mathf.Min(h - wb.y / 2f - 0.2f, 1.9f);
            Block("CardBoard_North_Frame", new Vector3(0f, northY, -half + 0.05f), new Vector3(wb.x + 0.2f, wb.y + 0.2f, 0.1f), boardFrameMaterial, false);
            var northFace = Block("CardBoard_North", new Vector3(0f, northY, -half + 0.11f), new Vector3(wb.x, wb.y, 0.02f), boardMaterial, false);
            cardBoards.Add(northFace.transform);

            // ③ 南の壁の中央（低い壁の上に立てる）
            float southY = c.frontWallHeight + wb.y / 2f + 0.15f;
            Block("CardBoard_South_Frame", new Vector3(0f, southY, half + t / 2f), new Vector3(wb.x + 0.2f, wb.y + 0.2f, 0.1f), boardFrameMaterial, false);
            var southFace = Block("CardBoard_South", new Vector3(0f, southY, half + t / 2f - 0.06f), new Vector3(wb.x, wb.y, 0.02f), boardMaterial, false);
            cardBoards.Add(southFace.transform);

            // 動かない物をまとめて描画を軽くする
            StaticBatchingUtility.Combine(root.gameObject);
        }

        // 箱を1つ置く。obstacle = true ならプレイヤーやNPCがぶつかる障害物として記録する
        private GameObject Block(string name, Vector3 position, Vector3 scale, Material material, bool obstacle)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(root, false);
            go.transform.localPosition = position;
            go.transform.localScale = scale;
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = material;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            if (obstacle) obstacles.Add(new Bounds(position, scale));
            return go;
        }
    }
}
