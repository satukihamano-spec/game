using UnityEngine;
using UnityEngine.EventSystems;

namespace StarGame
{
    // 仮想ジョイスティック（移動用）。画面の左側に置いた透明な「タッチ領域」に付ける。
    //   ・普段は左下に薄く表示されている
    //   ・タッチ領域のどこかに指を置くと、ジョイスティックがその位置に移動する（指の位置から操作できる）
    //   ・指をずらした方向と量で移動する。指を離すと止まり、左下に戻る
    //   ・指をほとんど動かさず短くタップした場合は「その場所をタップした」として WorldTapInput に渡す
    // UnityのUIの仕組み（EventSystem）でタッチを受けるので、上に重なったボタンとは干渉しない。
    // 複数の指に対応：最初に触れた指だけを追いかける。
    public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        [SerializeField] private RectTransform baseRect; // 土台の円
        [SerializeField] private RectTransform knob; // 動くつまみ
        [SerializeField] private CanvasGroup baseGroup; // 普段は薄く表示するため
        [Tooltip("指をこの距離（UIの単位）ずらすと最大速度")] [SerializeField] private float radius = 64f;
        [Tooltip("これより小さいずれは無視（手ぶれ対策。0〜1）")] [SerializeField] private float deadZone = 0.12f;
        [Tooltip("指を離しているときのジョイスティックの位置（タッチ領域の左下からの距離）")] [SerializeField] private Vector2 idlePosition = new Vector2(100f, 120f);
        [SerializeField] private float idleAlpha = 0.45f;
        [Header("タップの判定")]
        [SerializeField] private WorldTapInput tapForward;
        [SerializeField] private float tapMaxMove = 14f;
        [SerializeField] private float tapMaxSeconds = 0.35f;

        // 他のスクリプトから今のジョイスティックを使うための入口
        public static VirtualJoystick Current { get; private set; }

        // 移動したい方向（長さ0〜1。上が +y、右が +x）
        public Vector2 Direction { get; private set; }

        private RectTransform zone;
        private Canvas canvas;
        private int pointerId = int.MinValue; // int.MinValue = 指が触れていない
        private Vector2 startScreen;
        private float downTime;
        private float maxMoved;

        private void Awake()
        {
            zone = (RectTransform)transform;
            canvas = GetComponentInParent<Canvas>();
            ResetStick();
        }

        private void OnEnable() => Current = this;

        private void OnDisable()
        {
            if (Current == this) Current = null;
            pointerId = int.MinValue;
            ResetStick();
        }

        public void OnPointerDown(PointerEventData e)
        {
            if (pointerId != int.MinValue) return; // 2本目の指は無視
            pointerId = e.pointerId;
            startScreen = e.position;
            downTime = Time.unscaledTime;
            maxMoved = 0f;
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(zone, e.position, e.pressEventCamera, out Vector2 local))
            {
                // タッチ領域の左下を基準にした位置（タッチ領域のピボットは左下にしてある）
                baseRect.anchoredPosition = local;
            }
            knob.anchoredPosition = Vector2.zero;
            baseGroup.alpha = 1f;
        }

        public void OnDrag(PointerEventData e)
        {
            if (e.pointerId != pointerId) return;
            float scale = canvas != null ? canvas.scaleFactor : 1f;
            Vector2 delta = (e.position - startScreen) / scale; // 画面のピクセル → UIの単位
            maxMoved = Mathf.Max(maxMoved, delta.magnitude);
            delta = Vector2.ClampMagnitude(delta, radius);
            knob.anchoredPosition = delta;
            Vector2 dir = delta / radius;
            Direction = dir.magnitude < deadZone ? Vector2.zero : dir;
        }

        public void OnPointerUp(PointerEventData e)
        {
            if (e.pointerId != pointerId) return;
            pointerId = int.MinValue;
            bool isTap = maxMoved < tapMaxMove && Time.unscaledTime - downTime < tapMaxSeconds;
            ResetStick();
            if (isTap && tapForward != null) tapForward.HandleTap(e.position);
        }

        private void ResetStick()
        {
            Direction = Vector2.zero;
            if (baseRect != null) baseRect.anchoredPosition = idlePosition;
            if (knob != null) knob.anchoredPosition = Vector2.zero;
            if (baseGroup != null) baseGroup.alpha = idleAlpha;
        }
    }
}
