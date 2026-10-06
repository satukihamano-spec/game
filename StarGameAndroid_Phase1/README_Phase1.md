# 星のゲーム（Android版）Phase 1 の手順

Phase 1 で作るもの：Android 向けの Unity プロジェクト、縦画面、3Dマップ、プレイヤー、仮想ジョイスティック、タッチ操作。

---

## 0. 準備（最初の1回だけ）

1. **Unity Hub をインストール**
   https://unity.com/download から Unity Hub をダウンロードしてインストールします。
2. **Unity 本体をインストール**
   - Unity Hub の左の「インストール」→「エディターをインストール」を開きます。
   - **Unity 6.3 LTS**（6000.3.x）を選びます。表示がなければ、一覧にある一番新しい「Unity 6 LTS」で大丈夫です。
   - モジュールを選ぶ画面で、次の3つにチェックを入れます。
     - **Android Build Support**
     - **OpenJDK**
     - **Android SDK & NDK Tools**
3. **プロジェクトを作る**
   - Unity Hub の「プロジェクト」→「新しいプロジェクト」を開き、テンプレートは **「Universal 3D」**（「3D (URP)」と表示される場合もあります）を選びます。
   - プロジェクト名は `StarGameAndroid` にします。
   - 保存場所は **`C:\UnityProjects`** にしてください（なければ作ります）。

   ⚠ 保存場所の名前に日本語（「デスクトップ」など）が入っていたり、OneDrive の中だったりすると、Android のビルドが失敗しやすくなります。英数字だけの場所にしてください。

---

## 1. ファイルを入れる

1. 配布した zip を展開します。中に `StarGame` フォルダがあります。
2. エクスプローラーで `C:\UnityProjects\StarGameAndroid\Assets` を開き、`StarGame` フォルダをまるごとコピーします。
3. Unity に戻ると、自動で読み込み（コンパイル）が始まります。
4. 下の **Console** ウィンドウに赤いエラーが出ていなければ成功です。
   - Console が見えないときは、上のメニューの「Window → General → Console」で開けます。
   - 「Input System を有効にして再起動しますか？」と聞かれたら **Yes** を押してください。

---

## 2. Unity で押すもの（上のメニュー「StarGame」）

| 順番 | メニュー | すること |
|---|---|---|
| ① | **StarGame → 1. Android設定を適用** | 縦画面固定・アプリID・64bit（ARM64）・IL2CPP を設定し、Android 用に切り替えます（数分かかることがあります） |
| ② | **StarGame → 2. ゲームシーンを作成（Phase 1）** | マップ・プレイヤー・カメラ・ジョイスティック・UI を自動で配置し、`Assets/StarGame/Scenes/Main.unity` に保存します |
| ③ | ▶（画面上の Play ボタン） | パソコン上でそのまま試せます |

### パソコンでの試し方

- **スマホの画面で見る：** Game タブ左上の「Game」を「**Simulator**」に切り替え、機種（例：Google Pixel 7）を選ぶと、スマホの画面の形で確認できます。
- **移動：** 左下のジョイスティックをマウスでドラッグするか、WASD キーを使います。
- **タップの確認：** 画面右側の床をクリックすると、黄色い丸い印が一瞬出ます。
- **戻るボタンの代わり：** Esc キーを押すと「ゲームを終了しますか？」が出ます。

※ マップは ▶ を押したときに組み立てられるので、Play していない間は Scene 画面に床や壁は表示されません。

---

## 3. Android スマホで確認する

### 方法A：USBケーブルでつないで直接起動（おすすめ）

1. スマホで「開発者向けオプション」を有効にします。
   - 「設定 → デバイス情報（端末情報）→ **ビルド番号** を7回タップ」します。
2. 「設定 → システム → 開発者向けオプション」で、**USB デバッグ** をオンにします。
3. USB ケーブルでスマホをパソコンにつなぎます。スマホに「USB デバッグを許可しますか？」と出たら、**許可** を押します。
4. Unity の「File → Build Profiles」を開き、Android を選びます。
5. 「Run Device」で自分のスマホを選び、**Build And Run** を押します。
   - 保存先を聞かれたら、`Builds` フォルダなどを作って選んでください。
   - 初回のビルドは10分以上かかることがあります。

### 方法B：APK ファイルを作ってスマホに入れる

1. Unity で **StarGame → 3. APKをビルド** を押します。
2. `C:\UnityProjects\StarGameAndroid\Builds\StarGame.apk` ができます。
3. このファイルをスマホにコピーし（USB、Google ドライブなど）、スマホでタップしてインストールします。
   - 「提供元不明のアプリ」の許可を求められたら、許可してください。

### スマホで確認すること（チェックリスト）

- [ ] アプリが起動し、縦画面のまま回転しない
- [ ] 左下にジョイスティックが薄く表示されている
- [ ] 画面の左半分のどこかを指でなぞると、その場所にジョイスティックが出て、プレイヤーが歩く
- [ ] 指を離すと止まり、ジョイスティックが左下に戻る
- [ ] 壁や柱を通り抜けない
- [ ] 画面の右側をタップすると、床に黄色い印が出る
- [ ] 右上の FPS がだいたい 55〜60 で動いている
- [ ] スマホの「戻る」操作で「ゲームを終了しますか？」が出る（「続ける」で戻れる）
- [ ] ノッチ（カメラの切り欠き）に FPS の表示が隠れていない

エミュレーターで試したい場合は、Android Studio の「Device Manager」で仮想スマホを作る方法もあります。ただし重いので、実機での確認がおすすめです。

---

## うまくいかないとき

| 症状 | 対処 |
|---|---|
| Console に赤いエラーが出る | エラーの文章をそのまま（またはスクリーンショットで）送ってください |
| 「Android Build Support がありません」と出る | Unity Hub の「インストール」→ 歯車 →「モジュールを加える」で、Android の3つを追加してください |
| ビルドで SDK や JDK のエラーが出る | 「Edit → Preferences → External Tools」で、Android の項目がすべて「Unity にインストール済みのものを使う」にチェックされているか確認してください |
| スマホが Run Device に出ない | USB デバッグがオンか確認し、ケーブルを挿し直して、スマホの許可画面を確認してください |
| 「終了しますか？」の日本語が □ になる | Phase 2 で日本語フォントを入れて直します |

---

## ファイルの説明（Assets/StarGame）

| ファイル | 役割 |
|---|---|
| `Scripts/Core/GameBootstrap.cs` | 起動時の Android 向け設定（60fps・縦画面・スリープしない） |
| `Scripts/Core/GameSceneController.cs` | 司令塔。マップ → プレイヤー → カメラ → タップ処理をつなぐ |
| `Scripts/World/MapConfig.cs` | マップの広さ・柱・ボードの大きさなどのデータ |
| `Scripts/World/MapBuilder.cs` | データから床・壁・柱・カード残数ボード（3か所）を組み立てる |
| `Scripts/Player/PlayerController.cs` | プレイヤーの移動（壁にめり込まない） |
| `Scripts/Player/FollowCamera.cs` | プレイヤーを斜め上から追いかけるカメラ |
| `Scripts/Controls/MoveInput.cs` | 移動入力の窓口（ジョイスティック／エディターではキーボードも） |
| `Scripts/Controls/VirtualJoystick.cs` | 仮想ジョイスティック |
| `Scripts/Controls/WorldTapInput.cs` | 3D画面のタップ（Phase 2 で NPC 選択に使う） |
| `Scripts/Controls/BackButtonRouter.cs` | Android の戻る操作（開いている画面から順に閉じる） |
| `Scripts/UI/SafeAreaFitter.cs` | ノッチやナビゲーションバーを避ける |
| `Scripts/UI/ExitConfirmDialog.cs` | 終了確認 |
| `Scripts/UI/FpsCounter.cs` | 動作の軽さの確認用 FPS 表示 |
| `Scripts/UI/TapMarker.cs` | タップした場所の印 |
| `Editor/StarGameSetup.cs` | メニュー「StarGame」の中身（設定・シーン作成・APK ビルド） |
