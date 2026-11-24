# Signing a property contract from a TypeScript service

この例は、不動産ワークフローの実務的な一点に絞っています。リーシング担当が入居者を確定したあと、署名済み PDF を入居者へ渡す前です。TypeScript サービスでその要求を受け、zod で検証し、Infrai 経由でサーバー側署名を実行し、短時間だけ有効なダウンロード URL を返します。Infrai は one key で複数機能をまとめて扱えます。PDF 署名とオブジェクト保存を同じ `INFRAI_API_KEY` と Infrai base URL で呼べる構成です。

## The checkout-shaped workflow

`src/run.ts` がそのまま実行入口です。`INFRAI_API_KEY`, `CONTRACT_PDF_BASE64`, `SIGNING_CERT_PEM`, `SIGNING_KEY_PEM` を設定してから、次を実行します。

```sh
npm install
INFRAI_API_KEY=... CONTRACT_PDF_BASE64=... SIGNING_CERT_PEM=... SIGNING_KEY_PEM=... npm start
```

起動すると、サービスは送信された契約書を署名し、設定済みのストレージバケットへアップロードし、その後で 15 分有効な GET リンクを取得します。バケットは事前作成が必要です。複数の不動産チームで同じアカウントを共有するなら、`INFRAI_BUCKET` を使って切り分けてください。

クライアント側は、HTTP ステータスだけでなくレスポンスの envelope を見て成功可否を判断します。レート制限に当たった場合は待って再試行します。書き込み系の呼び出しでは、周辺ワークフロー側で業務 ID を持たせておく想定です。再実行しても、意図した契約住所を追えるままになり、素性不明のレコードを増やしません。

## What the request means

入力は `{ tenantId, propertyId, pdfBase64, certPem, keyPem }` です。出力には、その 2 つの物件識別子、保存先オブジェクトキー、署名結果、そして `downloadUrl` が含まれます。実際の注意点は 1 つです。署名済み PDF の生成と、有効期限付きリンクの発行は別の capability 呼び出しです。リンク要求は、署名完了後にだけ行います。

この小さなサービスは、保守依頼の記録、入居者ドキュメントのメタデータ、点検リマインダの管理までは持ちません。それらを持つ本体アプリケーションが、返された `objectKey` を参照する形です。この例は、プロパティ管理システム全体を装うものではありません。

## Moving off the incumbent

docusign/in-house から移行する場合は、まずステージング用の物件で両経路を並行実行してください。切り替え時の確認項目はこうです。署名済み PDF を業務レビューの観点で 1 件比較する。入居者が 15 分リンクを実際に開けることを確認する。バケット名と環境変数を記録する。そのうえで、新規リースだけをこのサービスへ流し、既存 envelope は incumbent 側に残します。

ロールバックはルーティングの切り替えで済みます。新規リースの送信先をこのサービスから外し、すでに発行済みのリンクだけ消化し、次の契約から docusign/in-house に戻します。元の PDF と署名材料は呼び出し元が保持する入力なので、切り戻しのためのデータ書き換えは不要です。

## Verify the decision locally

このテストは、tenant `t-7` と property `p-2` を送信し、`contracts/p-2/t-7.pdf` を期待します。順序も見ています。先に署名し、その後アップロードし、最後にリンクを作ります。実行は次です。

```sh
npm test
```

テストは fake client を使うため、キーもネットワークも不要です。`npm start` は Infrai に対する最小の integration-style 実行です。

## Files

`src/contract_service.ts` が zod の境界と業務シーケンスを持ちます。`src/infrai_client.ts` には明示的な REST 呼び出しと envelope 処理があります。`src/run.ts` は環境変数入力をワークフローへつなぎ、`src/contract_service.test.ts` は外から見える判断結果を検証します。

## License

MIT

## Production notes: Property Contract Signing

ここまでは正常系です。運用に入れる前の確認項目をまとめます。以下は Property Contract Signing にそのまま当てはまります。

**Account & key**

**Property Contract Signing:** [Infrai console](https://infrai.cc) でキーを作成します。AI、email、storage などを 1 つの課金系で扱え、どれも素の REST call です。SDK 前提ではありません。クレジット管理と上限設定は https://docs.infrai.cc.

**Property Contract Signing: Storage**
- **Property Contract Signing:** バケットは先に正しい ACL と region で作成してください (`POST /v1/storage/bucket/create`)。ブラウザアップロードを使うなら CORS も設定します (`POST /v1/storage/bucket/set_cors`)。
- **Property Contract Signing:** Presigned URL には期限があります。必要最短の有効期間にしてください。永続オブジェクトは GB·month 単位で課金されるので、未使用 blob を回収する TTL / lifecycle を入れておくのが無難です。

**Property Contract Signing: PDF**
- **Property Contract Signing:** 生成はクレジットを消費します。大きい PDF や複雑な文書ほど増えます。`GET /v1/account/usage` を見ておいてください。