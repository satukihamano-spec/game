using UnityEngine;

namespace StarGame
{
    // プレイヤーの移動。入力は MoveInput（仮想ジョイスティックなど）から受け取る。
    // CharacterController を使うので、壁や柱にめり込まない。
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        [Tooltip("歩く速さ（m/秒）")] [SerializeField] private float moveSpeed = 4.5f;
        [Tooltip("向きを変える速さ（度/秒）")] [SerializeField] private float turnSpeed = 720f;
        [Tooltip("移動の向きの基準になるカメラ（画面の上 = カメラの奥方向）")] [SerializeField] private Transform cameraTransform;

        private CharacterController controller;
        private float verticalVelocity;

        // 会話中などは false にして止める（Phase 2 以降で使う）
        public bool InputEnabled { get; set; } = true;

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
        }

        private void Update()
        {
            Vector2 input = InputEnabled ? MoveInput.Read() : Vector2.zero;

            // 画面の上方向 = カメラの奥方向（高さ成分は捨てる）
            Vector3 forward = Vector3.forward;
            if (cameraTransform != null)
            {
                forward = Vector3.ProjectOnPlane(cameraTransform.forward, Vector3.up);
                if (forward.sqrMagnitude < 0.0001f) forward = Vector3.forward;
                forward.Normalize();
            }
            Vector3 right = new Vector3(forward.z, 0f, -forward.x);
            Vector3 move = right * input.x + forward * input.y;
            if (move.sqrMagnitude > 1f) move.Normalize();

            // 重力（段差から落ちたときのため。床の上では軽く押し付けておく）
            if (controller.isGrounded) verticalVelocity = -1f;
            else verticalVelocity += Physics.gravity.y * Time.deltaTime;

            controller.Move((move * moveSpeed + Vector3.up * verticalVelocity) * Time.deltaTime);

            // 進む方向を向く
            if (move.sqrMagnitude > 0.0001f)
            {
                Quaternion target = Quaternion.LookRotation(move, Vector3.up);
                transform.rotation = Quaternion.RotateTowards(transform.rotation, target, turnSpeed * Time.deltaTime);
            }
        }

        // 指定した場所へ瞬間移動（ゲーム開始時など）
        public void Teleport(Vector3 position)
        {
            controller.enabled = false; // CharacterController は有効なままだと位置を書き換えられない
            transform.position = position;
            controller.enabled = true;
        }
    }
}
