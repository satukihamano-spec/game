using UnityEngine;
using UnityEngine.UI;

namespace StarGame
{
    // 動作の軽さを確かめるためのFPS表示（0.5秒ごとに更新）。完成版では消すか、設定でON/OFFにする。
    [RequireComponent(typeof(Text))]
    public class FpsCounter : MonoBehaviour
    {
        private Text label;
        private int frames;
        private float elapsed;

        private void Awake() => label = GetComponent<Text>();

        private void Update()
        {
            frames++;
            elapsed += Time.unscaledDeltaTime;
            if (elapsed < 0.5f) return;
            label.text = $"FPS {Mathf.RoundToInt(frames / elapsed)}";
            frames = 0;
            elapsed = 0f;
        }
    }
}
