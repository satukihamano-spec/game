using System;
using System.Collections.Generic;
using UnityEngine;

namespace StarGame
{
    // Androidの「戻る」操作（戻るボタン・戻るジェスチャー）をまとめて処理する。
    // 開いている画面（会話・情報一覧・メニューなど）が Push で「戻るときの処理」を登録しておくと、
    // 一番新しく開いた画面から順に閉じる。何も開いていなければ「ゲームを終了しますか？」を出す。
    //   Phase 1：終了確認だけ
    //   Phase 2 以降：会話画面 → 閉じる、情報画面 → 閉じる、メニュー → 閉じる を登録していく
    public class BackButtonRouter : MonoBehaviour
    {
        [SerializeField] private ExitConfirmDialog exitDialog;

        private static readonly List<Func<bool>> handlers = new List<Func<bool>>();

        // 戻る操作が来たときの処理を登録する（true を返したら「処理した」）
        public static void Push(Func<bool> handler) => handlers.Add(handler);
        public static void Remove(Func<bool> handler) => handlers.Remove(handler);

        private void Update()
        {
            if (!BackPressedThisFrame()) return;
            for (int i = handlers.Count - 1; i >= 0; i--)
            {
                if (handlers[i]()) return;
            }
            exitDialog.Toggle();
        }

        // Android の戻る操作は、Unity では Escape キーとして届く
        private static bool BackPressedThisFrame()
        {
#if ENABLE_INPUT_SYSTEM
            var k = UnityEngine.InputSystem.Keyboard.current;
            return k != null && k.escapeKey.wasPressedThisFrame;
#elif ENABLE_LEGACY_INPUT_MANAGER
            return Input.GetKeyDown(KeyCode.Escape);
#else
            return false;
#endif
        }
    }
}
