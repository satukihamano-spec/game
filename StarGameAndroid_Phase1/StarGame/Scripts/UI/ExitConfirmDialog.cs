using UnityEngine;
using UnityEngine.UI;

namespace StarGame
{
    // 「ゲームを終了しますか？」の確認画面。開いている間はゲームを一時停止する。
    public class ExitConfirmDialog : MonoBehaviour
    {
        [SerializeField] private GameObject root;
        [SerializeField] private Button quitButton;
        [SerializeField] private Button continueButton;

        private float savedTimeScale = 1f;

        public bool IsOpen => root != null && root.activeSelf;

        private void Awake()
        {
            quitButton.onClick.AddListener(Quit);
            continueButton.onClick.AddListener(Close);
            root.SetActive(false);
        }

        public void Toggle()
        {
            if (IsOpen) Close();
            else Open();
        }

        public void Open()
        {
            savedTimeScale = Time.timeScale;
            Time.timeScale = 0f;
            root.SetActive(true);
        }

        public void Close()
        {
            root.SetActive(false);
            Time.timeScale = savedTimeScale;
        }

        private void Quit()
        {
            Time.timeScale = 1f;
            Application.Quit(); // エディターでは何も起きない（実機でアプリが終わる）
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#endif
        }
    }
}
