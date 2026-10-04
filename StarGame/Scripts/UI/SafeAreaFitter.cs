using UnityEngine;

namespace StarGame
{
    // スマホのノッチ（カメラの切り欠き）やナビゲーションバーにUIが隠れないよう、
    // このUIの範囲を「安全な表示領域（Screen.safeArea）」に合わせる。
    [RequireComponent(typeof(RectTransform))]
    public class SafeAreaFitter : MonoBehaviour
    {
        private RectTransform rect;
        private Rect lastSafeArea;
        private Vector2Int lastScreen;

        private void Awake()
        {
            rect = (RectTransform)transform;
            Apply();
        }

        private void Update()
        {
            // 変わったときだけ計算し直す（軽くするため）
            if (Screen.safeArea != lastSafeArea || Screen.width != lastScreen.x || Screen.height != lastScreen.y) Apply();
        }

        private void Apply()
        {
            lastSafeArea = Screen.safeArea;
            lastScreen = new Vector2Int(Screen.width, Screen.height);
            if (Screen.width <= 0 || Screen.height <= 0) return;
            Vector2 min = lastSafeArea.position;
            Vector2 max = lastSafeArea.position + lastSafeArea.size;
            min.x /= Screen.width;
            min.y /= Screen.height;
            max.x /= Screen.width;
            max.y /= Screen.height;
            rect.anchorMin = min;
            rect.anchorMax = max;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }
    }
}
