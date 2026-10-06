using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.UI;

namespace StarGame.EditorTools
{
    // Unity の上のメニュー「StarGame」から実行するセットアップ。
    //   1. Android設定を適用 … 縦画面固定・アプリID・64bit(ARM64)・IL2CPP など
    //   2. ゲームシーンを作成 … 3Dマップ・プレイヤー・カメラ・ジョイスティック・UI を自動で配置して保存
    //   3. APKをビルド       … スマホに入れられるファイル（Builds/StarGame.apk）を作る
    // 何度実行しても同じ結果になる（作り直したいときにもう一度押せばよい）。
    public static class StarGameSetup
    {
        private const string Root = "Assets/StarGame";
        private const string ArtDir = Root + "/Art";
        private const string MaterialDir = Root + "/Materials";
        private const string DataDir = Root + "/Data";
        private const string SceneDir = Root + "/Scenes";
        private const string ScenePath = SceneDir + "/Main.unity";

        private const string ApplicationId = "com.satuki.stargame";
        private const string ApkPath = "Builds/StarGame.apk";

        private static readonly Color Background = new Color(0.043f, 0.043f, 0.063f);

        // ───────────── 1. Android設定 ─────────────

        [MenuItem("StarGame/1. Android設定を適用", priority = 1)]
        public static void ApplyAndroidSettings()
        {
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Android, BuildTarget.Android))
            {
                EditorUtility.DisplayDialog(
                    "Android Build Support がありません",
                    "Unity Hub の「インストール」→ 使っている Unity の歯車 →「モジュールを加える」から\n" +
                    "「Android Build Support」（OpenJDK と Android SDK & NDK Tools も）を追加してください。",
                    "OK");
                return;
            }

            var android = NamedBuildTarget.Android;
            PlayerSettings.companyName = "Satuki";
            PlayerSettings.productName = "StarGame";
            PlayerSettings.SetApplicationIdentifier(android, ApplicationId);

            // 64bit（Google Play の必須条件）。IL2CPP は 64bit に必要で、動作も速い
            PlayerSettings.SetScriptingBackend(android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;

            // 縦画面に固定
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;

            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            AssetDatabase.SaveAssets();
            EditorUtility.DisplayDialog("完了", "Android 向けの設定を適用しました。\n次に「StarGame → 2. ゲームシーンを作成」を押してください。", "OK");
        }

        // ───────────── 2. シーン作成 ─────────────

        [MenuItem("StarGame/2. ゲームシーンを作成（Phase 1）", priority = 2)]
        public static void CreateScene()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            foreach (var dir in new[] { ArtDir, MaterialDir, DataDir, SceneDir }) Directory.CreateDirectory(dir);
            AssetDatabase.Refresh();

            // 画像（円・輪・床のタイル）をその場で作る。外部の素材は使わない
            Sprite circle = SaveSprite("Circle.png", MakeCircle(256, 0f));
            Sprite ring = SaveSprite("Ring.png", MakeCircle(256, 0.84f));
            Texture2D tile = SaveTexture("FloorTile.png", MakeTile(128));

            // 材質（スマホ向けに軽いシェーダーを使う）
            Material floorMat = SaveMaterial("Floor", new Color(0.36f, 0.37f, 0.40f), LitShader(), tile);
            Material wallMat = SaveMaterial("Wall", new Color(0.42f, 0.43f, 0.46f), LitShader());
            Material pillarMat = SaveMaterial("Pillar", new Color(0.33f, 0.35f, 0.37f), LitShader());
            Material boardMat = SaveMaterial("CardBoard", new Color(0.06f, 0.06f, 0.08f), UnlitShader());
            Material boardFrameMat = SaveMaterial("CardBoardFrame", new Color(0.85f, 0.15f, 0.15f), UnlitShader());
            Material playerMat = SaveMaterial("Player", new Color(0.85f, 0.76f, 0.48f), LitShader());
            Material playerFaceMat = SaveMaterial("PlayerFace", new Color(0.15f, 0.15f, 0.18f), LitShader());
            Material markerMat = SaveMaterial("TapMarker", new Color(1f, 0.83f, 0.3f), UnlitShader());

            // マップのデータ（15分モード相当の広さ。Phase 6 でモードごとに変える）
            MapConfig config = LoadOrCreate<MapConfig>(DataDir + "/MapConfig_15min.asset");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 環境光と霧（遠くを暗くして閉鎖空間らしく。描画距離も短くできる）
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.45f, 0.47f, 0.52f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = Background;
            RenderSettings.fogStartDistance = 18f;
            RenderSettings.fogEndDistance = 42f;
            RenderSettings.skybox = null;

            // ライト（影なし：スマホの負荷対策）
            var lightGo = new GameObject("Directional Light");
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.1f;
            light.shadows = LightShadows.None;
            lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            // カメラ
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Background;
            cam.fieldOfView = 60f; // 縦画面でも左右が見えるように少し広め
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 60f; // 霧の先は描かない
            camGo.AddComponent<AudioListener>();
            var follow = camGo.AddComponent<FollowCamera>();

            // マップ（ゲーム開始時に MapConfig から組み立てる）
            var mapGo = new GameObject("Map");
            var map = mapGo.AddComponent<MapBuilder>();
            Set(map, "config", config);
            Set(map, "floorMaterial", floorMat);
            Set(map, "wallMaterial", wallMat);
            Set(map, "pillarMaterial", pillarMat);
            Set(map, "boardMaterial", boardMat);
            Set(map, "boardFrameMaterial", boardFrameMat);

            // プレイヤー（当たり判定は CharacterController。見た目は単純な形の組み合わせで軽く）
            var playerGo = new GameObject("Player");
            var cc = playerGo.AddComponent<CharacterController>();
            cc.center = new Vector3(0f, 0.8f, 0f);
            cc.height = 1.6f;
            cc.radius = 0.4f;
            cc.stepOffset = 0.3f;
            var player = playerGo.AddComponent<PlayerController>();
            Set(player, "cameraTransform", camGo.transform);
            Visual(PrimitiveType.Capsule, "Body", playerGo.transform, new Vector3(0f, 0.7f, 0f), new Vector3(0.8f, 0.7f, 0.8f), playerMat);
            Visual(PrimitiveType.Sphere, "Head", playerGo.transform, new Vector3(0f, 1.55f, 0f), Vector3.one * 0.5f, playerMat);
            Visual(PrimitiveType.Cube, "Face", playerGo.transform, new Vector3(0f, 1.58f, 0.22f), new Vector3(0.28f, 0.1f, 0.1f), playerFaceMat); // 向きが分かる印
            Set(follow, "target", playerGo.transform);

            // タップした場所に出る印（最初は非表示）
            var marker = Visual(PrimitiveType.Cylinder, "TapMarker", null, Vector3.zero, new Vector3(1f, 0.02f, 1f), markerMat);
            var tapMarker = marker.AddComponent<TapMarker>();
            marker.SetActive(false);

            // UI（画面のボタン・ジョイスティックなど）
            var ui = BuildUi(cam, circle, ring);

            // 司令塔
            var gameGo = new GameObject("Game");
            gameGo.AddComponent<GameBootstrap>();
            var controller = gameGo.AddComponent<GameSceneController>();
            Set(controller, "map", map);
            Set(controller, "player", player);
            Set(controller, "followCamera", follow);
            Set(controller, "worldTap", ui.worldTap);
            Set(controller, "tapMarker", tapMarker);
            var back = gameGo.AddComponent<BackButtonRouter>();
            Set(back, "exitDialog", ui.exitDialog);

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            EditorUtility.DisplayDialog(
                "完了",
                "ゲームシーンを作成しました（Assets/StarGame/Scenes/Main.unity）。\n\n" +
                "上の ▶（Play）を押すと試せます。\n" +
                "エディターでは、マウスで左下のジョイスティックをドラッグ、または WASD キーで移動できます。",
                "OK");
        }

        // ───────────── 3. APKをビルド ─────────────

        [MenuItem("StarGame/3. APKをビルド", priority = 3)]
        public static void BuildApk()
        {
            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
            {
                EditorUtility.DisplayDialog("先に Android 設定を", "「StarGame → 1. Android設定を適用」を先に実行してください。", "OK");
                return;
            }
            if (!File.Exists(ScenePath))
            {
                EditorUtility.DisplayDialog("シーンがありません", "「StarGame → 2. ゲームシーンを作成」を先に実行してください。", "OK");
                return;
            }
            Directory.CreateDirectory(Path.GetDirectoryName(ApkPath));
            EditorUserBuildSettings.buildAppBundle = false; // テスト用は APK（Google Play に出すときは AAB）
            var options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = ApkPath,
                target = BuildTarget.Android,
                options = BuildOptions.None,
            };
            var report = BuildPipeline.BuildPlayer(options);
            bool ok = report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded;
            if (ok) EditorUtility.RevealInFinder(ApkPath);
            EditorUtility.DisplayDialog(
                ok ? "ビルド成功" : "ビルド失敗",
                ok ? $"{ApkPath} を作りました。スマホにコピーしてインストールできます。" : "Console ウィンドウの赤いエラーを確認してください。",
                "OK");
        }

        // ───────────── UI ─────────────

        private struct UiRefs
        {
            public WorldTapInput worldTap;
            public ExitConfirmDialog exitDialog;
        }

        private static UiRefs BuildUi(Camera cam, Sprite circle, Sprite ring)
        {
            // EventSystem（タッチをUIに届ける仕組み）。新しい Input System と古い Input Manager のどちらでも動くようにする
            var esGo = new GameObject("EventSystem");
            esGo.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM
            var module = esGo.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();
            module.AssignDefaultActions();
#else
            esGo.AddComponent<StandaloneInputModule>();
#endif

            // Canvas：基準サイズ 390×844（一般的なスマホ縦画面）。UIの1単位 ≒ 1dp になるようにする
            var canvasGo = new GameObject("Canvas", typeof(RectTransform));
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(390f, 844f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;
            canvasGo.AddComponent<GraphicRaycaster>();

            // ① 一番うしろ：3D画面のタップを受ける透明な板（画面全体）
            var worldArea = NewRect("WorldTouchArea", canvasGo.transform, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            Img(worldArea, null, new Color(0f, 0f, 0f, 0f), true);
            var worldTap = worldArea.gameObject.AddComponent<WorldTapInput>();
            Set(worldTap, "worldCamera", cam);

            // ② 安全な表示領域（ノッチ・ナビゲーションバーを避ける）
            var safe = NewRect("SafeArea", canvasGo.transform, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            safe.gameObject.AddComponent<SafeAreaFitter>();

            // ③ 移動用ジョイスティック：画面の左半分・下から85%まで（上の15%は Phase 2 以降のステータス表示用に空ける）
            var zone = NewRect("JoystickZone", safe, new Vector2(0f, 0f), new Vector2(0.5f, 0.85f), new Vector2(0f, 0f), Vector2.zero, Vector2.zero);
            Img(zone, null, new Color(0f, 0f, 0f, 0f), true);
            var stickBase = NewRect("StickBase", zone, Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), new Vector2(100f, 120f), new Vector2(136f, 136f));
            Img(stickBase, ring, new Color(1f, 1f, 1f, 0.55f), false);
            var group = stickBase.gameObject.AddComponent<CanvasGroup>();
            group.blocksRaycasts = false;
            var knob = NewRect("StickKnob", stickBase, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(64f, 64f));
            Img(knob, circle, new Color(1f, 0.83f, 0.3f, 0.85f), false);
            var joystick = zone.gameObject.AddComponent<VirtualJoystick>();
            Set(joystick, "baseRect", stickBase);
            Set(joystick, "knob", knob);
            Set(joystick, "baseGroup", group);
            Set(joystick, "tapForward", worldTap);

            // ④ FPS表示（動作確認用・右上）
            var fps = NewRect("FPS", safe, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-8f, -8f), new Vector2(110f, 28f));
            var fpsText = Txt(fps, "FPS --", 16, TextAnchor.UpperRight, new Color(1f, 1f, 1f, 0.75f));
            fpsText.raycastTarget = false;
            fps.gameObject.AddComponent<FpsCounter>();

            // ⑤ 終了確認（Androidの戻る操作で開く）
            var dim = NewRect("ExitDialog", canvasGo.transform, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            Img(dim, null, new Color(0f, 0f, 0f, 0.6f), true); // 後ろのボタンを押せないようにふさぐ
            var panel = NewRect("Panel", dim, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(320f, 200f));
            Img(panel, null, new Color(0.08f, 0.08f, 0.1f, 0.97f), true);
            var msg = NewRect("Message", panel, new Vector2(0f, 0.45f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            Txt(msg, "ゲームを終了しますか？", 22, TextAnchor.MiddleCenter, Color.white);
            var quit = Btn("QuitButton", panel, new Vector2(-76f, 48f), "終了する", new Color(0.7f, 0.15f, 0.15f));
            var cont = Btn("ContinueButton", panel, new Vector2(76f, 48f), "続ける", new Color(1f, 0.83f, 0.3f));
            var exitDialog = canvasGo.AddComponent<ExitConfirmDialog>(); // いつも有効な Canvas に付ける（ダイアログ本体は非表示にする）
            Set(exitDialog, "root", dim.gameObject);
            Set(exitDialog, "quitButton", quit);
            Set(exitDialog, "continueButton", cont);
            dim.gameObject.SetActive(false);

            return new UiRefs { worldTap = worldTap, exitDialog = exitDialog };
        }

        private static RectTransform NewRect(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 position, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = pivot;
            rt.anchoredPosition = position;
            rt.sizeDelta = size;
            return rt;
        }

        private static Image Img(RectTransform rt, Sprite sprite, Color color, bool raycast)
        {
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.color = color;
            img.raycastTarget = raycast;
            return img;
        }

        private static Text Txt(RectTransform rt, string text, int size, TextAnchor anchor, Color color)
        {
            var t = rt.gameObject.AddComponent<Text>();
            t.text = text;
            t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); // 日本語は端末のフォントで表示される（Phase 2 で日本語フォントを入れる）
            t.fontSize = size;
            t.alignment = anchor;
            t.color = color;
            t.raycastTarget = false;
            return t;
        }

        // ボタン（120×56。指で押しやすい大きさ）
        private static Button Btn(string name, RectTransform parent, Vector2 position, string label, Color color)
        {
            var rt = NewRect(name, parent, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0.5f), position, new Vector2(132f, 56f));
            var img = Img(rt, null, color, true);
            var btn = rt.gameObject.AddComponent<Button>();
            btn.targetGraphic = img;
            var labelRt = NewRect("Label", rt, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            Txt(labelRt, label, 20, TextAnchor.MiddleCenter, color.grayscale > 0.5f ? Color.black : Color.white);
            return btn;
        }

        // ───────────── 3Dの見た目 ─────────────

        // 見た目だけの形（当たり判定は消す）
        private static GameObject Visual(PrimitiveType type, string name, Transform parent, Vector3 localPos, Vector3 scale, Material mat)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            Object.DestroyImmediate(go.GetComponent<Collider>());
            if (parent != null) go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localScale = scale;
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = ShadowCastingMode.Off;
            r.receiveShadows = false;
            return go;
        }

        // ───────────── 素材を作る ─────────────

        // スマホ向けの軽いシェーダー（URP なら Simple Lit。なければ標準）
        private static Shader LitShader()
        {
            return FindShader("Universal Render Pipeline/Simple Lit", "Universal Render Pipeline/Lit", "Standard");
        }

        private static Shader UnlitShader()
        {
            return FindShader("Universal Render Pipeline/Unlit", "Unlit/Color", "Standard");
        }

        private static Shader FindShader(params string[] names)
        {
            foreach (var n in names)
            {
                var s = Shader.Find(n);
                if (s != null) return s;
            }
            return null;
        }

        private static Material SaveMaterial(string name, Color color, Shader shader, Texture texture = null)
        {
            string path = $"{MaterialDir}/{name}.mat";
            var mat = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (mat == null)
            {
                mat = new Material(shader);
                AssetDatabase.CreateAsset(mat, path);
            }
            else if (shader != null)
            {
                mat.shader = shader;
            }
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
            if (mat.HasProperty("_Color")) mat.SetColor("_Color", color);
            if (texture != null)
            {
                if (mat.HasProperty("_BaseMap")) mat.SetTexture("_BaseMap", texture);
                if (mat.HasProperty("_MainTex")) mat.SetTexture("_MainTex", texture);
            }
            mat.enableInstancing = true;
            EditorUtility.SetDirty(mat);
            return mat;
        }

        private static T LoadOrCreate<T>(string path) where T : ScriptableObject
        {
            var asset = AssetDatabase.LoadAssetAtPath<T>(path);
            if (asset != null) return asset;
            asset = ScriptableObject.CreateInstance<T>();
            AssetDatabase.CreateAsset(asset, path);
            return asset;
        }

        // シリアライズされた（インスペクターに出る）項目に値を入れる
        private static void Set(Object target, string field, Object value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(field);
            if (prop == null)
            {
                Debug.LogError($"[StarGameSetup] {target.GetType().Name} に {field} がありません");
                return;
            }
            prop.objectReferenceValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static Sprite SaveSprite(string file, Texture2D tex)
        {
            string path = $"{ArtDir}/{file}";
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = false;
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }

        private static Texture2D SaveTexture(string file, Texture2D tex)
        {
            string path = $"{ArtDir}/{file}";
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Default;
            importer.wrapMode = TextureWrapMode.Repeat;
            importer.mipmapEnabled = true;
            importer.filterMode = FilterMode.Bilinear;
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        // 円（inner > 0 なら輪）。ふちをなめらかにする
        private static Texture2D MakeCircle(int size, float inner)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            float r = size / 2f;
            var pixels = new Color32[size * size];
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float d = Mathf.Sqrt((x + 0.5f - r) * (x + 0.5f - r) + (y + 0.5f - r) * (y + 0.5f - r)) / r; // 0〜1
                    float a = Mathf.Clamp01((1f - d) * r); // 外側のふち
                    if (inner > 0f) a *= Mathf.Clamp01((d - inner) * r); // 内側のふち
                    pixels[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            }
            tex.SetPixels32(pixels);
            tex.Apply();
            return tex;
        }

        // 床のタイル（目地の線）
        private static Texture2D MakeTile(int size)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, true);
            var pixels = new Color32[size * size];
            var line = new Color32(150, 152, 160, 255);
            var fill = new Color32(225, 225, 228, 255);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    bool edge = x < 2 || y < 2;
                    pixels[y * size + x] = edge ? line : fill;
                }
            }
            tex.SetPixels32(pixels);
            tex.Apply();
            return tex;
        }
    }
}
