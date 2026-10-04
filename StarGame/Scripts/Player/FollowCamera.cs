using UnityEngine;

namespace StarGame
{
    // プレイヤーの斜め後ろ上から見下ろして追いかけるカメラ（縦画面向けに少し高く・広く見せる）
    [RequireComponent(typeof(Camera))]
    public class FollowCamera : MonoBehaviour
    {
        [SerializeField] private Transform target;
        [Tooltip("プレイヤーから見たカメラの位置")] [SerializeField] private Vector3 offset = new Vector3(0f, 13.5f, 10f);
        [Tooltip("追いかける速さ（大きいほどすぐ追いつく）")] [SerializeField] private float followSharpness = 6f;
        [Tooltip("プレイヤーのどの高さを見るか")] [SerializeField] private float lookHeight = 1f;

        private void LateUpdate()
        {
            if (target == null) return;
            Vector3 desired = target.position + offset;
            float t = 1f - Mathf.Exp(-followSharpness * Time.deltaTime); // フレームレートに関係なく同じ速さで追う
            transform.position = Vector3.Lerp(transform.position, desired, t);
            transform.LookAt(target.position + Vector3.up * lookHeight);
        }

        // すぐに定位置へ（ゲーム開始時）
        public void Snap()
        {
            if (target == null) return;
            transform.position = target.position + offset;
            transform.LookAt(target.position + Vector3.up * lookHeight);
        }
    }
}
