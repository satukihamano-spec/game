# GitHub Actions で Android APK を自動ビルドする手順

GitHub にファイルを送る（push する）と、GitHub のサーバーが Unity プロジェクトを Android の APK にビルドします。できた APK は GitHub の画面からダウンロードできます。

全体の流れ：

1. ファイルを置く
2. GitHub にリポジトリを作る
3. Secrets（合言葉）を登録する
4. commit / push
5. Actions を実行
6. APK をダウンロード
7. スマホにインストール

---

## 0. 先にやっておくこと（Phase 1 の手順書の内容）

GitHub Actions は「Unity プロジェクト」をビルドします。先に PC で Unity プロジェクトを作っておく必要があります。

1. `README_Phase1.md` の手順で、`C:\UnityProjects\StarGameAndroid` に Unity プロジェクトを作ります。
   - Unity は 6.3 LTS、テンプレートは「Universal 3D」です。
2. `StarGame` フォルダを `Assets` の中にコピーします。
3. Unity の上のメニューで、次の2つを順に実行します。
   - **StarGame → 1. Android設定を適用**
   - **StarGame → 2. ゲームシーンを作成**

   ⚠ 2 を実行しないと「ビルドするシーンがない」状態になり、GitHub Actions が失敗します。
4. Unity を閉じます。閉じるときに保存するか聞かれたら「保存」を選んでください。

---

## ① ファイルを置く

この zip に入っている次の3つを、Unity プロジェクトの一番上のフォルダ（`Assets` と同じ場所）にコピーします。

```
C:\UnityProjects\StarGameAndroid\
├─ .github\
│   └─ workflows\
│       └─ android-build.yml   ← 自動ビルドの手順書（GitHub Actions）
├─ .gitignore                   ← GitHub に入れないファイルの一覧
├─ .gitattributes               ← 改行コードなどの設定
├─ Assets\
├─ Packages\
└─ ProjectSettings\
```

⚠ `.gitignore` は、最初のコミットより **前に** 置いてください。置かないと、`Library` という巨大なフォルダ（数GB）まで GitHub に送られてしまいます。

---

## ② GitHub にリポジトリ（保存場所）を作り、送る

コマンドを使わない **GitHub Desktop** での方法です。

1. https://github.com で GitHub アカウントを作ります（持っていれば不要）。
2. https://desktop.github.com から **GitHub Desktop** をインストールして起動し、GitHub アカウントでサインインします。
3. GitHub Desktop で、上のメニューの **File → Add local repository…** を開きます。
4. 「Local path」の **Choose…** で `C:\UnityProjects\StarGameAndroid` を選びます。
5. 「このフォルダはリポジトリではありません」と表示されたら、青い文字の **create a repository** をクリックします。
   - Name：`StarGameAndroid`
   - Git ignore：**None**（もう `.gitignore` を置いてあるため）
   - **Create repository** を押します
6. 左の「Changes」に一覧が出ます。**`Library/` で始まるファイルが入っていないこと** を確認してください。
   - 何千個もある場合は `.gitignore` が正しい場所にありません。
7. 上の **Publish repository** を押します。
   - **Keep this code private** のチェックは入れたままにします（非公開）。
   - **Publish repository** を押すと、GitHub にアップロードされます。

送った時点で自動ビルドが1回動きます。まだ Secrets を登録していないので「2. 事前チェック」で止まりますが、問題ありません。③ のあとでやり直します。

---

## ③ GitHub Secrets（Unity のライセンス）を登録する

GitHub のサーバーで Unity を動かすには、あなたの Unity アカウントのライセンスが必要です。パスワードなどは GitHub の **Secrets（秘密の値）** に入れます。Secrets の中身は、ログにも画面にも表示されません。

### 必要な Secret（3つ）

| Secret の名前（このとおり大文字で） | 入れるもの |
|---|---|
| `UNITY_LICENSE` | ライセンスファイル `Unity_lic.ulf` の中身すべて |
| `UNITY_EMAIL` | Unity アカウントのメールアドレス |
| `UNITY_PASSWORD` | Unity アカウントのパスワード |

### 3-1. ライセンスファイル（Unity_lic.ulf）を用意する

1. **Unity Hub** を開き、左下の歯車（**Preferences / 環境設定**）→ **Licenses（ライセンス）** を開きます。
2. **Add（追加）** → **Get a free personal license（無料の個人ライセンスを取得）** を押します。
   - すでにライセンスが表示されていても、ファイルが作られていないことがあるので、一度この操作をしてください。
3. エクスプローラーの上のアドレス欄に `C:\ProgramData\Unity` と入力して Enter を押します。
   - `ProgramData` は隠しフォルダなので、直接入力して開きます。
4. `Unity_lic.ulf` を右クリック →「プログラムから開く」→ **メモ帳** で開きます。
5. **Ctrl + A**（全部選択）→ **Ctrl + C**（コピー）します。

### 3-2. GitHub に登録する

1. ブラウザで `https://github.com/あなたのユーザー名/StarGameAndroid` を開きます。
2. 上のタブの一番右 **Settings（設定）** をクリックします。
3. 左のメニューの **Secrets and variables** → **Actions** をクリックします。
4. 緑の **New repository secret** ボタンを押します。
5. **Name** に `UNITY_LICENSE`、**Secret** にコピーした中身を貼り付けて（Ctrl + V）、**Add secret** を押します。
6. 同じように **New repository secret** から、あと2つ登録します。
   - Name `UNITY_EMAIL` → Unity のメールアドレス
   - Name `UNITY_PASSWORD` → Unity のパスワード

### 注意

- **パスワードがない場合：** Google や Apple で Unity にログインしていてパスワードを作っていない場合は、Unity のアカウント設定（https://id.unity.com）でパスワードを設定してください。
- **2段階認証：** Unity アカウントで2段階認証（認証アプリ）を使っていると、ライセンス認証に失敗することがあります。その場合はエラーの文章を送ってください。
- **ライセンスファイルの扱い：** `Unity_lic.ulf` は個人のライセンスです。GitHub のリポジトリには絶対に入れず、Secrets にだけ入れてください。

---

## ④ ゲームを変更したとき（commit / push）

Unity でゲームを変更したら、GitHub Desktop で次のようにします。

1. 左下の **Summary** に変更の説明（例：`ジョイスティックを調整`）を書きます。
2. **Commit to main** を押します。
3. 上の **Push origin** を押します。

`Assets`・`Packages`・`ProjectSettings` の中が変わっていれば、自動でビルドが始まります。

---

## ⑤ Actions を実行する（手動）

1. GitHub のリポジトリのページで、上の **Actions** タブを開きます。
2. 左の一覧から **Android APK ビルド** をクリックします。
3. 右側の **Run workflow** → ブランチが **main** になっていることを確認 → 緑の **Run workflow** を押します。
4. 数秒後に一覧に実行が出ます。印の意味は次のとおりです。

| 印 | 意味 |
|---|---|
| 🟡 黄色い丸 | 実行中（初回は **30〜60分** かかることがあります。2回目からは速くなります） |
| ✅ 緑のチェック | 成功 |
| ❌ 赤のバツ | 失敗（下の「失敗したとき」へ） |

一度失敗した実行をやり直すときは、その実行を開いて右上の **Re-run jobs** → **Re-run all jobs** を押します。

---

## ⑥ APK をダウンロードする

1. Actions タブで、✅ になった実行をクリックします。
2. ページを下にスクロールすると **Artifacts** という欄があります。
3. **StarGame-Android-APK-（番号）** をクリックすると、zip ファイルがダウンロードされます。
4. zip を展開すると、中に **StarGame.apk** があります。

Artifacts は **14日間** 保存されます。それより古いものは消えるので、必要なら新しくビルドしてください。

---

## ⑦ Android スマホにインストールする

### 方法A：スマホだけで行う

1. スマホのブラウザ（Chrome）で github.com にログインし、⑥ と同じ手順で zip をダウンロードします。
2. 「Files by Google」などのファイルアプリで zip を開き、**展開（解凍）** します。
3. **StarGame.apk** をタップします。
4. 「この提供元のアプリを許可」と出たら、設定画面で **許可** をオンにして戻ります。
5. **インストール** を押します。
6. 「Play プロテクト」の警告が出たら、**詳細** → **インストールする（このまま）** を選びます。
   - 自分で作ったアプリは Google に登録されていないため、この警告が出ます。

### 方法B：PC からコピーする

1. スマホを USB ケーブルで PC につなぎ、スマホ側で「ファイル転送」を選びます。
2. エクスプローラーで、スマホの `Download` フォルダに StarGame.apk をコピーします。
3. スマホのファイルアプリで `Download` を開き、StarGame.apk をタップします。
4. あとは方法A の 4 以降と同じです。

### 新しいバージョンを入れるときの注意

今の設定では、ビルドのたびに署名（アプリの持ち主を示す印）が変わります。そのため、新しい APK を上書きインストールしようとすると「アプリがインストールされていません」と出ることがあります。

その場合は、**古い StarGame をアンインストールしてから** 新しい APK を入れてください。自分専用の署名鍵（keystore）を Secrets に登録すれば、この手間はなくせます。これは Google Play 公開（AAB）の準備と一緒に行う予定です。

---

## 失敗したとき

1. ❌ になった実行をクリックします。
2. 一番上の **Summary** に「❌ ビルドに失敗しました」と、よくある原因の表が出ます。
3. 左の一覧で **赤い ✗ の付いた手順** をクリックすると、詳しいログが見られます。

| どこで失敗したか | よくある原因 |
|---|---|
| 2. 事前チェック | Secrets の未登録、シーン未作成など。赤い枠のメッセージのとおりに直してください |
| 5. Unity でビルド（「license」「activation」の文字がある） | UNITY_LICENSE が古い・途中までしか貼られていない、メールアドレスやパスワードの間違い |
| 5. Unity でビルド（「manifest unknown」「not found」） | そのバージョンの Unity のビルド用イメージがまだありません（https://game.ci/docs/docker/versions で確認） |
| 5. Unity でビルド（「error CS」で始まる行） | C# のコードのエラー |

分からないときは、**赤い ✗ の手順のログの、最後の30行くらい** をコピーして送ってください。

---

## 補足

- **Unity のバージョン：** ビルドに使う Unity のバージョンは、プロジェクトの `ProjectSettings/ProjectVersion.txt` から自動で読み取ります。ワークフローでバージョンを固定していないので、プロジェクトと違うバージョンでビルドされることはありません。
- **Android の開発ツール：** Android SDK / NDK / OpenJDK は、GameCI という仕組みが用意する Unity のビルド用環境に入っているので、自分で用意する必要はありません。
- **無料で使える時間：** 非公開のリポジトリでは、GitHub Actions を毎月 2,000 分まで無料で使えます。1回のビルドは 20〜40 分くらいなので、月に 50 回前後ビルドできます。
- **出力先：** できる APK は、ビルドしたサーバーの中の `Builds/Android/StarGame.apk` です。これが Artifacts として保存されます。
