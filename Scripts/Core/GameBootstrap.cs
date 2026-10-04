using UnityEngine;

namespace StarGame
{
    // ゲーム起動時に、Androidスマホ向けの基本設定を行う。
    //   ・フレームレート（60fps。バッテリーを優先したいときは30にする）
    //   ・縦画面に固定
    //   ・プレイ中は画面が暗くならない（スリープしない）
    [DefaultExecutionOrder(-1000)] // 他のどのスクリプトより先に動く
    public class GameBootstrap : MonoBehaviour
    {
        [Tooltip("目標のフレームレート。60 = なめらか / 30 = バッテリー節約")]
        [SerializeField] private int targetFrameRate = 60;

        private void Awake()
        {
            QualitySettings.vSyncCount = 0; // Android では targetFrameRate で制御する
            Application.targetFrameRate = targetFrameRate;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Screen.orientation = ScreenOrientation.Portrait;
        }
    }
}
