using UnityEngine;

namespace StarGame
{
    // ゲーム画面の「司令塔」。部品（マップ・プレイヤー・カメラ・入力）を順番に準備してつなぐ。
    // Phase 1 では：マップを作る → プレイヤーを置く → カメラを合わせる → タップした場所に印を出す
    // （Phase 2 以降で、NPC・会話・カードなどをここにつないでいく）
    public class GameSceneController : MonoBehaviour
    {
        [SerializeField] private MapBuilder map;
        [SerializeField] private PlayerController player;
        [SerializeField] private FollowCamera followCamera;
        [SerializeField] private WorldTapInput worldTap;
        [SerializeField] private TapMarker tapMarker;

        private void Start()
        {
            map.Build();
            player.Teleport(map.PlayerStart);
            followCamera.Snap();
            worldTap.Tapped += OnWorldTapped;
        }

        private void OnDestroy()
        {
            if (worldTap != null) worldTap.Tapped -= OnWorldTapped;
        }

        // 3D画面がタップされた。Phase 1 では、タッチが正しく届いているか確かめるために印を出すだけ。
        // Phase 2 で「NPCをタップして選ぶ」処理に置き換える。
        private void OnWorldTapped(RaycastHit hit)
        {
            tapMarker.Show(hit.point);
        }
    }
}
