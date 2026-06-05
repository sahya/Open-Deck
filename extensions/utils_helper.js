/* カラム内で使う細々とした機能を実装する */
(() => {
    const OPD_DEBUG = true;
    function opd_debug(...args){ if(OPD_DEBUG) console.log("%c[OPD-DEBUG:UTILS-HELPER]", "background:#607d8b;color:#fff;padding:2px 4px;border-radius:3px;", ...args); }

    opd_debug("utils_helper.js 読み込み - URL:", location.href);
    console.log("UtilsWorking")
    /* ポスト画面などテキスト入力フォーカス状態を送信するようにする関数 */
    function sendTextFocusState(){
        opd_debug("sendTextFocusState 設定中...");
        //フォーカスされた時
        window.addEventListener('focusin', (e) => {
            if (e.target.getAttribute('contenteditable') === 'true' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                opd_debug("フォーカスIN:", e.target.tagName, "contenteditable:", e.target.getAttribute('contenteditable'), "id:", e.target.id);
                window.parent.dispatchEvent(new CustomEvent('opd_post_focus', {detail: JSON.stringify(true)}));
            }
        });
        //フォーカスが外れた時
        window.addEventListener('focusout', (e) => {
            opd_debug("フォーカスOUT:", e.target.tagName);
            window.parent.dispatchEvent(new CustomEvent('opd_post_focus', {detail: JSON.stringify(false)}));
        });
        opd_debug("sendTextFocusState 設定完了");
    }

    sendTextFocusState();
})();