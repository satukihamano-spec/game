using UnityEngine;

namespace StarGame
{
    // タップした場所に一瞬だけ出る印（タッチが届いているかの確認用。Phase 2 では選んだNPCの印にも使える）
    public class TapMarker : MonoBehaviour
    {
        [SerializeField] private float duration = 0.35f;
        [SerializeField] private float startSize = 0.3f;
        [SerializeField] private float endSize = 1.2f;

        private float timeLeft;
        // ※ 最初は非表示（シーンでは非アクティブの状態で保存してある）

        public void Show(Vector3 point)
        {
            transform.position = new Vector3(point.x, point.y + 0.03f, point.z);
            timeLeft = duration;
            gameObject.SetActive(true);
            Apply(0f);
        }

        private void Update()
        {
            timeLeft -= Time.deltaTime;
            if (timeLeft <= 0f)
            {
                gameObject.SetActive(false);
                return;
            }
            Apply(1f - timeLeft / duration);
        }

        private void Apply(float t)
        {
            float s = Mathf.Lerp(startSize, endSize, t);
            transform.localScale = new Vector3(s, 0.02f, s);
        }
    }
}
