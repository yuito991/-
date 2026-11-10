# Fischer Quest Android

独立したAndroidアプリID `io.github.yuito991.fischerquest` で公開サイトを表示します。Chrome・Custom Tabs・WebAPKのランチャーを経由せず、Android標準WebViewをアプリ内に配置します。

## インストール

GitHub Actionsの `Build Android APK` が成功したら、`Fischer-Quest-Android` のArtifactをダウンロードして展開し、`Fischer-Quest-Android.apk` をAndroidスマートフォンで開きます。Androidが表示するインストール確認に従ってください。Android 8.0以上に対応します。

アプリ名は `Fischer Quest` です。既存のWebAPK `Fischer's Quest` とは別アプリです。OPPOの利用制限でこの新しいアプリを許可対象にしてください。端末によっては利用履歴に出すために一度アプリを起動する必要があります。OPPO実機での制限モード動作は未確認です。

初回はAPIキーを再入力してください。ブラウザとは別のアプリ専用保存領域に、動画キャッシュ・視聴リスト・進捗・30分ロックを保存します。サイトの更新はアプリに反映されるため、通常のサイト修正だけならAPKの再インストールは不要です。オンライン接続と有効なAndroid System WebViewが必要です。

## ビルド

JDK 17、Gradle 8.13、Android SDK 36を用意して、このフォルダで以下を実行します。

```sh
gradle :app:assembleDebug :app:lintDebug
```

署名付きの個人利用用APKが `app/build/outputs/apk/debug/app-debug.apk` に生成されます。デバッグ署名を使いますが、アプリのWebViewデバッグは無効です。署名鍵は各ビルド環境で生成され、リポジトリや配布物には含めません。別の環境で再ビルドしたAPKは署名が異なる場合があり、その場合の上書き更新はできません。今回のAPKは手元に保管してください。アンインストールするとアプリ内データも削除されます。

APIキーをソースコードへ埋め込みません。ネイティブの権限はインターネット接続だけで、端末の利用制限を変更・回避する機能は持ちません。
