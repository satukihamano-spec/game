using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace StarGame
{
    // 3D画面のタップを受け取る。画面全体を覆う透明なUI（一番うしろ）に付ける。
    // UIのボタンの上をタップしたときはボタンが先に受け取るので、ここには来ない（誤タップ防止）。
    // タップした位置からカメラで光線を飛ばし、当たった3Dの物を Tapped で知らせる。
    //   Phase 1：タップした床に印を出す（タッチの確認用）
    //   Phase 2：NPCをタップして選ぶ
    public class WorldTapInput : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        [SerializeField] private Camera worldCamera;
        [SerializeField] private float tapMaxMove = 14f; // UIの単位
        [SerializeField] private float tapMaxSeconds = 0.35f;
        [SerializeField] private float rayDistance = 100f;

        public event Action<RaycastHit> Tapped;

        private Canvas canvas;
        private int pointerId = int.MinValue;
        private Vector2 startScreen;
        private float downTime;

        private void Awake()
        {
            canvas = GetComponentInParent<Canvas>();
            if (worldCamera == null) worldCamera = Camera.main;
        }

        public void OnPointerDown(PointerEventData e)
        {
            pointerId = e.pointerId;
            startScreen = e.position;
            downTime = Time.unscaledTime;
        }

        public void OnPointerUp(PointerEventData e)
        {
            if (e.pointerId != pointerId) return;
            pointerId = int.MinValue;
            float scale = canvas != null ? canvas.scaleFactor : 1f;
            bool isTap = (e.position - startScreen).magnitude / scale < tapMaxMove && Time.unscaledTime - downTime < tapMaxSeconds;
            if (isTap) HandleTap(e.position);
        }

        // 画面の位置（ピクセル）をタップした（ジョイスティックの領域でのタップもここに来る）
        public void HandleTap(Vector2 screenPosition)
        {
            if (worldCamera == null) return;
            Ray ray = worldCamera.ScreenPointToRay(screenPosition);
            if (Physics.Raycast(ray, out RaycastHit hit, rayDistance)) Tapped?.Invoke(hit);
        }
    }
}
