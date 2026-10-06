using UnityEngine;

namespace StarGame
{
    // 「どちらに移動したいか」をまとめて返す窓口。
    // ゲーム本体（PlayerController）はここだけを見るので、入力の種類が増えても本体を変えなくてよい。
    //   ・スマホ：仮想ジョイスティック（VirtualJoystick）
    //   ・Unityエディターで試すとき：キーボードの WASD / 矢印キー（スマホの実機では使わない）
    public static class MoveInput
    {
        public static Vector2 Read()
        {
            Vector2 v = VirtualJoystick.Current != null ? VirtualJoystick.Current.Direction : Vector2.zero;
#if UNITY_EDITOR
            v += EditorKeyboard();
#endif
            return Vector2.ClampMagnitude(v, 1f);
        }

#if UNITY_EDITOR
        // エディターでのテスト用。新しい Input System と古い Input Manager のどちらの設定でも動くようにしている
        private static Vector2 EditorKeyboard()
        {
#if ENABLE_INPUT_SYSTEM
            var k = UnityEngine.InputSystem.Keyboard.current;
            if (k == null) return Vector2.zero;
            float x = (k.dKey.isPressed || k.rightArrowKey.isPressed ? 1f : 0f) - (k.aKey.isPressed || k.leftArrowKey.isPressed ? 1f : 0f);
            float y = (k.wKey.isPressed || k.upArrowKey.isPressed ? 1f : 0f) - (k.sKey.isPressed || k.downArrowKey.isPressed ? 1f : 0f);
            return new Vector2(x, y);
#elif ENABLE_LEGACY_INPUT_MANAGER
            return new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
#else
            return Vector2.zero;
#endif
        }
#endif
    }
}
