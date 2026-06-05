// 文章校正機能で使用する、カスタムな文字置換イベントを作成する
(() => {
    const OPD_DEBUG = true;
    function opd_debug(...args){ if(OPD_DEBUG) console.log("%c[OPD-DEBUG:POST-HELPER]", "background:#2196f3;color:#fff;padding:2px 4px;border-radius:3px;", ...args); }
    function opd_debug_warn(...args){ if(OPD_DEBUG) console.warn("%c[OPD-DEBUG:POST-HELPER]", "background:#ff9800;color:#000;padding:2px 4px;border-radius:3px;", ...args); }
    function opd_debug_error(...args){ if(OPD_DEBUG) console.error("%c[OPD-DEBUG:POST-HELPER]", "background:#f44336;color:#fff;padding:2px 4px;border-radius:3px;", ...args); }

    opd_debug("text_review_helper.js 読み込み開始");
    opd_debug("現在のURL:", location.href);
    opd_debug("document.readyState:", document.readyState);

    const isAllowed = (u) => {
        const url = new URL(u, location.href);
        const result = url.origin === location.origin && url.pathname.startsWith("/intent/tweet");
        opd_debug("isAllowed チェック:", u, "=> 結果:", result);
        return result;
    };
    //GIF ボタンを消す
    opd_debug("GIFボタン非表示CSS注入中...");
    document.querySelector("head").insertAdjacentHTML("beforeend", `<style opd_post_css>main button[data-testid="gifSearchButton"]{display:none;}div[data-testid="twc-cc-mask"]{display:none;}</style>`);
    opd_debug("GIFボタン非表示CSS注入完了");

    // DOM変化を監視してポストUI要素のデバッグ情報を出力
    let postUIDetected = false;
    new MutationObserver(function(mutations){
        const back_button = document.querySelector('main button[data-testid="app-bar-back"]');
        if(!back_button) return;
        if(location.pathname === "/intent/tweet"){
            back_button.style.display = "none";
        }else{
            back_button.style.display = "block";
        }

        // ポストUIの主要要素を検出してログ出力(初回のみ)
        if(!postUIDetected){
            const tweetTextarea = document.querySelector('div[data-testid="tweetTextarea_0"]');
            const tweetButton = document.querySelector('div[data-testid="tweetButton"], button[data-testid="tweetButton"]');
            const toolBar = document.querySelector('div[data-testid="toolBar"]');
            const editor = document.querySelector('[contenteditable="true"]');
            if(tweetTextarea || tweetButton || editor){
                postUIDetected = true;
                opd_debug("===== ポストUI要素検出 =====");
                opd_debug("  tweetTextarea:", !!tweetTextarea, tweetTextarea?.tagName);
                opd_debug("  tweetButton:", !!tweetButton, tweetButton?.tagName, "disabled:", tweetButton?.getAttribute("aria-disabled"));
                opd_debug("  toolBar:", !!toolBar);
                opd_debug("  contentEditable:", !!editor, editor?.tagName);
                opd_debug("  main要素:", !!document.querySelector("main"));

                // tweetButtonのクリックイベントを監視
                if(tweetButton){
                    const origClick = tweetButton.click;
                    tweetButton.addEventListener("click", () => {
                        opd_debug("★★★ 投稿ボタンクリック検出 ★★★");
                        opd_debug("  テキスト内容:", editor?.textContent?.substring(0, 100));
                        opd_debug("  ボタンdisabled状態:", tweetButton.getAttribute("aria-disabled"));
                    }, true);
                    opd_debug("投稿ボタンクリック監視を設定");
                }

                // contentEditableに入力監視を追加
                if(editor){
                    editor.addEventListener("input", () => {
                        opd_debug("テキスト入力検出:", editor.textContent?.substring(0, 50));
                    });
                    opd_debug("テキスト入力監視を設定");
                }
            }
        }
    }).observe(document, {childList: true, subtree: true});

    // ネットワークリクエストを監視 (fetch/XHR をフック)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const method = args[1]?.method || 'GET';
        if(url.includes('CreateTweet') || url.includes('CreateRetweet') || url.includes('graphql')){
            opd_debug(`★ fetch リクエスト検出: ${method} ${url.substring(0, 120)}`);
            if(args[1]?.body){
                try {
                    const bodyStr = typeof args[1].body === 'string' ? args[1].body : '';
                    opd_debug("  リクエストボディ(先頭200文字):", bodyStr.substring(0, 200));
                } catch(e) { /* ignore */ }
            }
            try {
                const response = await originalFetch.apply(this, args);
                opd_debug(`★ fetch レスポンス: ${response.status} ${response.statusText} - ${url.substring(0, 80)}`);
                if(!response.ok){
                    opd_debug_error(`★ fetch エラーレスポンス: ${response.status} - ${url.substring(0, 80)}`);
                    // レスポンスを読み取ってログ出力（cloneして元のレスポンスは壊さない）
                    try {
                        const cloned = response.clone();
                        const text = await cloned.text();
                        opd_debug_error("  エラーレスポンスボディ(先頭500文字):", text.substring(0, 500));
                    } catch(e) { /* ignore */ }
                }
                return response;
            } catch(e) {
                opd_debug_error(`★ fetch ネットワークエラー: ${e.message} - ${url.substring(0, 80)}`);
                throw e;
            }
        }
        return originalFetch.apply(this, args);
    };
    opd_debug("fetch フック設定完了");

    // XMLHttpRequest も監視
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._opd_url = url;
        this._opd_method = method;
        if(url && (String(url).includes('CreateTweet') || String(url).includes('intent/tweet'))){
            opd_debug(`★ XHR open: ${method} ${String(url).substring(0, 120)}`);
        }
        return origXHROpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if(this._opd_url && (String(this._opd_url).includes('CreateTweet') || String(this._opd_url).includes('intent/tweet'))){
            opd_debug(`★ XHR send: ${this._opd_method} ${String(this._opd_url).substring(0, 120)}`);
            this.addEventListener("load", () => {
                opd_debug(`★ XHR レスポンス: status=${this.status} - ${String(this._opd_url).substring(0, 80)}`);
                if(this.status >= 400){
                    opd_debug_error("  XHR エラーレスポンス:", this.responseText?.substring(0, 500));
                }
            });
            this.addEventListener("error", () => {
                opd_debug_error(`★ XHR ネットワークエラー - ${String(this._opd_url).substring(0, 80)}`);
            });
        }
        return origXHRSend.call(this, body);
    };
    opd_debug("XHR フック設定完了");

    (function() {
        //投稿後の遷移メッセージを無効化する
        opd_debug("beforeunload 阻止設定中...");
        const native_add_evt = EventTarget.prototype.addEventListener;
        native_add_evt.call(window, 'beforeunload', function (e){
            opd_debug("beforeunload イベント阻止実行");
            // 既存イベントをストップさせる
            e.stopImmediatePropagation();
        }, {capture: true});

        //以後追加されるイベントを阻止する
        EventTarget.prototype.addEventListener = function (type, listener, options){
            if(String(type).toLowerCase() === 'beforeunload'){
                opd_debug("beforeunload リスナー登録を阻止");
                return;
            }
            return native_add_evt.call(this, type, listener, options);
        };
        opd_debug("beforeunload 阻止設定完了");

        //投稿後は home に戻ってほしくないので遷移を阻止する
        opd_debug("history.pushState フック設定中...");
        const originalPushState = history.pushState;
        history.pushState = function(state, title, url) {
            const dest = url ? new URL(url, location.href).href : location.href;
            opd_debug("history.pushState 呼び出し検出 - 遷移先:", dest);
            if (!isAllowed(dest)){
                opd_debug_warn("history.pushState 阻止! 投稿後のhome遷移をブロック - 遷移先:", dest);
                //home への遷移を阻止
                location.replace(location.href);
                return;
            }
            opd_debug("history.pushState 許可 - 遷移先:", dest);
            return originalPushState.apply(this, arguments);
        };
        opd_debug("history.pushState フック設定完了");

        // history.replaceState も監視
        const originalReplaceState = history.replaceState;
        history.replaceState = function(state, title, url) {
            const dest = url ? new URL(url, location.href).href : location.href;
            opd_debug("history.replaceState 呼び出し検出 - 遷移先:", dest);
            return originalReplaceState.apply(this, arguments);
        };
        opd_debug("history.replaceState フック設定完了");

        // popstate イベントも監視
        window.addEventListener("popstate", (e) => {
            opd_debug("popstate イベント発火 - 現在のURL:", location.href, "state:", e.state);
        });
    })();

    //校正周りの処理
    let target_editor_elem = null;
    let opd_paste_token = null;
    document.addEventListener("focusin", (ev) => {
        if(ev.target && ev.target.isContentEditable){
            opd_debug("contentEditable要素にフォーカス:", ev.target.tagName, "id:", ev.target.id, "class:", ev.target.className);
            target_editor_elem = ev.target;

            // React内部のpropsを確認
            try {
                const propsKey = Object.getOwnPropertyNames(ev.target).find(k => k.includes('__reactProps$'));
                const fiberKey = Object.getOwnPropertyNames(ev.target).find(k => k.includes('__reactFiber$'));
                opd_debug("  reactProps キー:", propsKey || "なし");
                opd_debug("  reactFiber キー:", fiberKey || "なし");
                if(propsKey){
                    const props = ev.target[propsKey];
                    const editor = props?.children?.props?.editor ?? props?.children?.[0]?.props?.editor ?? null;
                    opd_debug("  内部editor オブジェクト:", editor ? "検出" : "なし");
                    if(editor){
                        opd_debug("  editor._onPaste:", typeof editor._onPaste);
                        opd_debug("  editor メソッド一覧:", Object.getOwnPropertyNames(Object.getPrototypeOf(editor)).filter(m => m.startsWith("_on")).join(", "));
                    }
                }
            } catch(e) {
                opd_debug_warn("  React props 調査エラー:", e.message);
            }
        }
    });
    const handler = async(e) => {
        opd_debug("opd_text_review_apply ハンドラ呼び出し");
        //Firefox では detail にオブジェクトを乗せられない様なので、JSON化している
        const detail = JSON.parse(e.detail);
        opd_debug("  テキスト:", detail.text?.substring(0, 50), "トークン:", detail.token?.substring(0, 8) + "...", "Firefox:", detail.is_firefox);
        //貼り付け時のトークンをチェックする
        if(opd_paste_token && opd_paste_token !== detail.token){
            opd_debug_warn("  トークン不一致! 期待:", opd_paste_token?.substring(0, 8) + "...", "受信:", detail.token?.substring(0, 8) + "...");
            return;
        }
        opd_debug("  トークン認証OK");

        //X側のテキストエディタの内部関数を利用してテキストを正しく入力させる
        if(target_editor_elem && target_editor_elem.isContentEditable){
            opd_debug("  target_editor_elem 有効 - テキスト貼り付け処理開始");
            //文字を全て選択する
            text_all_select(target_editor_elem);
            //選択が終わるまで待機
            await new Promise(resolve => setTimeout(resolve, 30));

            //Firefox では　DataTransfer や ClipboardEvent 使えないので動作を分ける
            if (!detail.is_firefox) {
                opd_debug("  Chrome/Edge モード - ReactProps経由でペースト");
                //ReactPropsを入手する
                const propsKey = Object.getOwnPropertyNames(target_editor_elem).find(k => k.includes('__reactProps$'));
                const props = propsKey ? target_editor_elem[propsKey] : null;
                const editor = props?.children?.props?.editor ??props?.children?.[0]?.props?.editor ?? null;
                opd_debug("  propsKey:", propsKey, "editor:", !!editor, "editor._onPaste:", typeof editor?._onPaste);

                //校正結果のテキストの DataTransfer を作成
                const dt = new DataTransfer();
                dt.setData('text/plain', detail.text);

                //クリップボードのペーストのイベントを作成する
                const evt = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dt
                });
                //内部関数を使って校正文章を擬似的にペーストさせる
                if(editor?._onPaste){
                    opd_debug("  editor._onPaste 実行中...");
                    editor._onPaste(evt, editor);
                    opd_debug("  editor._onPaste 実行完了");
                } else {
                    opd_debug_error("  editor._onPaste が見つからない! ペースト失敗");
                }
            }else{
                opd_debug("  Firefox モード - execCommand使用");
                //execCommand は非推奨だが、Firefox では仕方なく使う様にする
                //文字を置換する
                const result = document.execCommand('insertText', false, detail.text);
                opd_debug("  execCommand 結果:", result);
            }
        } else {
            opd_debug_error("  target_editor_elem が無効! elem:", target_editor_elem, "isContentEditable:", target_editor_elem?.isContentEditable);
        }
    };

    async function text_all_select(target){
        opd_debug("text_all_select 実行 - target:", target?.tagName);
        //テキスト全選択させる関数
        if(!target && !target.isContentEditable) return false;

        const win = target.ownerDocument.defaultView;
        const doc = target.ownerDocument;

        target.focus();
        const sel = win.getSelection();
        sel.removeAllRanges();

        const range = doc.createRange();
        range.selectNodeContents(target);
        sel.addRange(range);
        opd_debug("text_all_select 完了 - 選択範囲:", range.toString()?.substring(0, 50));

        return true;
    }

    //テキスト貼り付けの認証トークン受付イベントを作成する
    window.addEventListener('opd_text_review_init', (e)=>{
        const detail = JSON.parse(e.detail);
        opd_paste_token = detail.token;
        opd_debug("opd_text_review_init トークン設定完了:", detail.token?.substring(0, 8) + "...");
    }, true);

    //テキストを貼り付けさせるイベントを作成する
    window.addEventListener('opd_text_review_apply', handler, true);

    opd_debug("text_review_helper.js 読み込み完了 - 全フック設定済み");

    // 定期的にポストUI状態をダンプ (10秒ごと、最大5回)
    let dumpCount = 0;
    const dumpInterval = setInterval(() => {
        if(++dumpCount > 5){
            clearInterval(dumpInterval);
            return;
        }
        opd_debug(`===== ポストUI定期ダンプ (${dumpCount}/5) =====`);
        opd_debug("  URL:", location.href);
        opd_debug("  pathname:", location.pathname);
        opd_debug("  document.readyState:", document.readyState);
        opd_debug("  main:", !!document.querySelector("main"));
        opd_debug("  tweetTextarea:", !!document.querySelector('div[data-testid="tweetTextarea_0"]'));
        opd_debug("  tweetButton:", !!document.querySelector('div[data-testid="tweetButton"], button[data-testid="tweetButton"]'));
        opd_debug("  toolBar:", !!document.querySelector('div[data-testid="toolBar"]'));
        opd_debug("  contentEditable要素:", document.querySelectorAll('[contenteditable="true"]').length);
        opd_debug("  target_editor_elem:", !!target_editor_elem);
        opd_debug("  opd_paste_token:", opd_paste_token ? "設定済み" : "未設定");

        // エラーダイアログの検出
        const errorDialog = document.querySelector('[role="alert"]');
        if(errorDialog){
            opd_debug_warn("  ★ エラーダイアログ検出:", errorDialog.textContent?.substring(0, 100));
        }
        // ログインウォールの検出
        const loginWall = document.querySelector('[data-testid="loginButton"]');
        if(loginWall){
            opd_debug_error("  ★ ログインウォール検出! ユーザーがログインしていない可能性");
        }
    }, 10000);
})();