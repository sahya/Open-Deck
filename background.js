const EXTENSION_DOMAIN = new URL(chrome.runtime.getURL('')).hostname;
const OPD_DEBUG = true;
function opd_debug(...args){ if(OPD_DEBUG) console.log("%c[OPD-DEBUG:BG]", "background:#4caf50;color:#fff;padding:2px 4px;border-radius:3px;", ...args); }
function opd_debug_warn(...args){ if(OPD_DEBUG) console.warn("%c[OPD-DEBUG:BG]", "background:#ff9800;color:#000;padding:2px 4px;border-radius:3px;", ...args); }
function opd_debug_error(...args){ if(OPD_DEBUG) console.error("%c[OPD-DEBUG:BG]", "background:#f44336;color:#fff;padding:2px 4px;border-radius:3px;", ...args); }

opd_debug("Background script 起動 - EXTENSION_DOMAIN:", EXTENSION_DOMAIN);

//インストール時にあらかじめDNRを設定しておく
chrome.runtime.onInstalled.addListener(() => {
    opd_debug("onInstalled 発火 - DNR初期設定開始");
    (async () => {
        await update_dnr();
        opd_debug("onInstalled - DNR初期設定完了");
    })();
})

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse){
        opd_debug("メッセージ受信:", request.message, "送信元:", sender.tab?.url?.substring(0, 60));
        if(request.message == "dnr_upd"){
            opd_debug("DNR更新要求を受信");
            (async () => {
                try {
                    await update_dnr();
                    opd_debug("DNR更新成功");
                    // 現在のDNRルールを確認
                    const rules = await chrome.declarativeNetRequest.getDynamicRules();
                    opd_debug("現在のDNRルール数:", rules.length);
                    rules.forEach((rule, i) => {
                        opd_debug(`  DNRルール[${i}]: id=${rule.id}, action=${rule.action.type}, 対象ドメイン:`, rule.condition.requestDomains);
                        if(rule.action.responseHeaders){
                            rule.action.responseHeaders.forEach(h => {
                                opd_debug(`    ヘッダー操作: ${h.operation} ${h.header}`);
                            });
                        }
                    });
                    console.log("dnr_update_ok");
                    sendResponse(true);
                } catch(e) {
                    opd_debug_error("DNR更新失敗:", e.message, e.stack);
                    console.error("dnr update failed->", e);
                    sendResponse(false);
                }
            })();
        }
        if(request.message == "text_review"){
            const api_url = "https://opd.kwdev-sys.com/api/opd/text_review/review";
            (async () => {
                try{
                    const res = await fetch(api_url, {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({"text":request.review_text}),
                    });

                    if(!res.ok){
                        console.error(`ReviewFetchError->Code:${res.status}->Text:${res.statusText}`);
                        sendResponse(false);
                        return;
                    }
                    sendResponse(await res.json());
                }catch(error){
                    console.error("Fetch failed:", error);
                    sendResponse(false);
                    return;
                }
            })();
        }
        if(request.message == "ext_reload"){
            chrome.runtime.reload();
        }
        return true;
    }
)
//
let access_limit = {
    search:{limit: null, remaining: null, reset_unix_time: null}, 
    time_line:{limit: null, remaining: null, reset_unix_time: null}, 
    recommend_timeline:{limit: null, remaining: null, reset_unix_time: null}
};
function send_content_script(value){
    //chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });//firefoxではsession.setAccessLevel()が未対応なのでsessionは一旦お預け
    //chrome.storage.session.set
    chrome.storage.local.set({api_access_limit: value}, function(){
        console.log("set ok");
      });
    /*chrome.storage.local.set({api_access_limit: value}).then(() => {
        console.log("set ok");
      });*/
}
chrome.webRequest.onHeadersReceived.addListener(function (resp) {
      // 投稿関連のAPIリクエストを検出してログ出力
      if(resp.url.search(/CreateTweet|CreateRetweet|FavoriteTweet|DeleteTweet|intent\/tweet/gi) != -1){
          opd_debug("投稿関連APIリクエスト検出:", resp.url.substring(0, 120));
          opd_debug("  ステータスコード:", resp.statusCode);
          opd_debug("  レスポンスヘッダー数:", resp.responseHeaders?.length);
          resp.responseHeaders?.forEach(h => {
              if(h.name.toLowerCase().includes("content-security-policy") || h.name.toLowerCase().includes("x-frame-options") || h.name.toLowerCase().includes("x-rate-limit")){
                  opd_debug(`  重要ヘッダー: ${h.name} = ${h.value?.substring(0, 100)}`);
              }
          });
      }
      // CSP/X-Frame-Optionsの除去確認ログ
      if(resp.url.includes("intent/tweet")){
          opd_debug("intent/tweet レスポンス受信 - URL:", resp.url.substring(0, 80));
          const csp = resp.responseHeaders?.find(h => h.name.toLowerCase() === "content-security-policy");
          const xfo = resp.responseHeaders?.find(h => h.name.toLowerCase() === "x-frame-options");
          opd_debug("  CSP ヘッダー:", csp ? `存在 (${csp.value?.substring(0, 80)}...)` : "なし(DNR除去済み)");
          opd_debug("  X-Frame-Options:", xfo ? `存在 (${xfo.value})` : "なし(DNR除去済み)");
      }
      if(resp.url.search(/SearchTimeline/g) != -1){
        //console.log(resp);
        for (let index = 0; index < resp.responseHeaders.length; index++) {
            switch (resp.responseHeaders[index].name) {
                case "x-rate-limit-remaining":
                    access_limit.search.remaining = resp.responseHeaders[index].value;
                    break;
                case "x-rate-limit-limit":
                    access_limit.search.limit = resp.responseHeaders[index].value;
                    break;
                case "x-rate-limit-reset":
                    access_limit.search.reset_unix_time = resp.responseHeaders[index].value;
                    break;
                default:
                    break;
            }
        }
        //(access_limit);
        send_content_script(access_limit);
      }
      if(resp.url.search(/HomeLatestTimeline/g) != -1){
        //console.log(resp);
        for (let index = 0; index < resp.responseHeaders.length; index++) {
            switch (resp.responseHeaders[index].name) {
                case "x-rate-limit-remaining":
                    access_limit.time_line.remaining = resp.responseHeaders[index].value;
                    break;
                case "x-rate-limit-limit":
                    access_limit.time_line.limit = resp.responseHeaders[index].value;
                    break;
                case "x-rate-limit-reset":
                    access_limit.time_line.reset_unix_time = resp.responseHeaders[index].value;
                    break;
                default:
                    break;
            }
        }
        //console.log(access_limit)
        send_content_script(access_limit);
      }
      if(resp.url.search(/HomeTimeline/g) != -1){
        //console.log(resp);
        for (let index = 0; index < resp.responseHeaders.length; index++) {
            switch (resp.responseHeaders[index].name) {
                case "x-rate-limit-remaining":
                    access_limit.recommend_timeline.remaining = resp.responseHeaders[index].value;
                    break;
                case "x-rate-limit-limit":
                    access_limit.recommend_timeline.limit = resp.responseHeaders[index].value;
                    break;
                case "x-rate-limit-reset":
                    access_limit.recommend_timeline.reset_unix_time = resp.responseHeaders[index].value;
                    break;
                default:
                    break;
            }
        }
        //console.log(access_limit)
        send_content_script(access_limit);
      }
    },{urls: ['*://x.com/i/api/*']},['responseHeaders']
  );

function update_dnr(){
    opd_debug("update_dnr() 実行 - DNRルール設定中...");
    opd_debug("  除去対象ヘッダー: Content-Security-Policy, X-Frame-Options");
    opd_debug("  対象ドメイン: x.com, twitter.com");
    opd_debug("  initiatorDomains:", EXTENSION_DOMAIN, "x.com", "twitter.com");
    const dnr_rules = [
        {
            id : 1,
            priority: 1,
            action: {
                type: "modifyHeaders",
                responseHeaders: [
                    {
                        header: "Content-Security-Policy",
                        operation: "remove"
                    },
                    {
                        header: "X-Frame-Options",
                        operation: "remove"
                    }
                ]
            },
            condition : {
                requestDomains: ["x.com", "twitter.com"],
                initiatorDomains: [EXTENSION_DOMAIN, "x.com", "twitter.com"],
                resourceTypes: ["main_frame",
                "sub_frame",
                "stylesheet",
                "script",
                "image",
                "font",
                "object",
                "xmlhttprequest",
                "ping",
                "csp_report",
                "media",
                "websocket",
                "other"]
            }
        },
    ];
    
    return chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: dnr_rules,
    });
}