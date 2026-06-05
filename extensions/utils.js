// メディアビューワー停止用
class OpdUtils {
    constructor() {
        this._debug = (...args) => { console.log("%c[OPD-DEBUG:UTILS]", "background:#795548;color:#fff;padding:2px 4px;border-radius:3px;", ...args); };
        this.Init = (column_window) => {
            this._debug("OpdUtils.Init() - column_window.location:", column_window.location?.href);
            //ヘルパースクリプト追加
            const helper_script = column_window.document.createElement('script');
            helper_script.src = chrome.runtime.getURL("extensions/utils_helper.js");
            helper_script.addEventListener("load", () => {
                this._debug("utils_helper.js 読み込み成功");
            });
            helper_script.addEventListener("error", (e) => {
                console.error("[OPD-DEBUG:UTILS] utils_helper.js 読み込み失敗:", e);
            });
            column_window.document.head.appendChild(helper_script);
            this._debug("utils_helper.js をheadに追加完了");
        }
    }
}