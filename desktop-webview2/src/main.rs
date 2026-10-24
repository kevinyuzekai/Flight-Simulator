// 天际航线 SkyRoute — Windows 桌面版 (系统 WebView2 外壳, Tauri v2)
// 与 0.5.3 Electron 外壳 (desktop/main.js) 行为对齐:
//  - 游戏文件内嵌在 exe 中, 以固定安全源 https://tauri.localhost 提供 (localStorage 持久保存, Gamepad/AudioWorklet 需安全上下文)
//  - 1440x900 窗口, 最小 960x600, 底色 #0b2a5b, 无菜单栏, 标题固定
//  - F11 全屏, Ctrl+Shift+I 开发者工具; 其余按键 (含 Ctrl+R/F5/Ctrl+F 等浏览器快捷键) 全部交给游戏
//  - 外部链接 / window.open 用系统浏览器打开; ms-windows-store: 打开失败时回退网页版商店
//  - 单实例; 不节流后台; 商店版 (WindowsApps 路径) 加 ?store=1
//  - 首次启动时把旧 Electron 版 (app://skyroute) 的 localStorage 设置迁移过来
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const TITLE: &str = "天际航线 SkyRoute";
const STORE_WEB: &str = "https://apps.microsoft.com/detail/9P25XZZM8JXT";
const STORE_URI: &str = "ms-windows-store://pdp/?productid=9P25XZZM8JXT";

fn is_app_url(u: &tauri::Url) -> bool {
    matches!(u.scheme(), "tauri" | "asset") || u.host_str() == Some("tauri.localhost")
}

fn open_external(url: &str) {
    if url.starts_with("http://") || url.starts_with("https://") {
        let _ = tauri_plugin_opener::open_url(url, None::<&str>);
    } else if url.eq_ignore_ascii_case(STORE_URI) {
        if tauri_plugin_opener::open_url(url, None::<&str>).is_err() {
            let _ = tauri_plugin_opener::open_url(STORE_WEB, None::<&str>);
        }
    }
}

// ---------- 旧 Electron localStorage 迁移 ----------
fn electron_ls_dirs() -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Ok(p) = std::env::var("SKYROUTE_ELECTRON_LS") { v.push(PathBuf::from(p)); }
    if let Ok(appdata) = std::env::var("APPDATA") {
        for name in ["天际航线 SkyRoute", "skyroute"] {
            v.push(Path::new(&appdata).join(name).join("Local Storage").join("leveldb"));
        }
    }
    v
}

fn decode_chromium_str(b: &[u8]) -> Option<String> {
    let (tag, rest) = b.split_first()?;
    match tag {
        1 => Some(rest.iter().map(|&c| c as char).collect()), // Latin-1
        0 => {
            if rest.len() % 2 != 0 { return None; }
            let u: Vec<u16> = rest.chunks(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
            String::from_utf16(&u).ok()
        }
        _ => None,
    }
}

pub fn read_electron_ls(dir: &Path, origin: &str) -> serde_json::Map<String, serde_json::Value> {
    use rusty_leveldb::LdbIterator;
    let mut out = serde_json::Map::new();
    if !dir.join("CURRENT").exists() { return out; }
    // 复制到临时目录再读, 不碰原数据 (也避开 LOCK)
    let tmp = std::env::temp_dir().join(format!("skyroute-ls-mig-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    if std::fs::create_dir_all(&tmp).is_err() { return out; }
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            let n = e.file_name();
            if n == "LOCK" { continue; }
            let _ = std::fs::copy(e.path(), tmp.join(&n));
        }
    }
    let mut opt = rusty_leveldb::Options::default();
    opt.create_if_missing = false;
    if let Ok(mut db) = rusty_leveldb::DB::open(&tmp, opt) {
        let prefix = {
            let mut p = b"_".to_vec(); p.extend_from_slice(origin.as_bytes()); p.push(0); p
        };
        if let Ok(mut it) = db.new_iter() {
            while let Some((k, v)) = it.next() {
                if let Some(rest) = k.strip_prefix(prefix.as_slice()) {
                    if let (Some(key), Some(val)) = (decode_chromium_str(rest), decode_chromium_str(&v)) {
                        out.insert(key, serde_json::Value::String(val));
                    }
                }
            }
        }
    }
    let _ = std::fs::remove_dir_all(&tmp);
    out
}

fn migration_script() -> Option<String> {
    for d in electron_ls_dirs() {
        let m = read_electron_ls(&d, "app://skyroute");
        if !m.is_empty() {
            let json = serde_json::Value::Object(m).to_string();
            return Some(format!(
                "(function(){{try{{var ls=window.localStorage;if(!ls||ls.getItem('skyroute.migratedFromElectron'))return;\
var M={json};for(var k in M){{if(ls.getItem(k)===null)ls.setItem(k,M[k]);}}\
ls.setItem('skyroute.migratedFromElectron','1');}}catch(e){{}}}})();"
            ));
        }
    }
    None
}

// ---------- 键盘: F11 全屏, Ctrl+Shift+I 开发者工具 ----------
const KEYS_SCRIPT: &str = r#"
(function(){
  if (window.__skyrouteShell) return; window.__skyrouteShell = true;
  function inv(c){ try { window.__TAURI_INTERNALS__.invoke(c); } catch(e){} }
  window.addEventListener('keydown', function(e){
    if (e.key === 'F11') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) inv('toggle_fullscreen'); }
    else if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) { e.preventDefault(); e.stopImmediatePropagation(); inv('toggle_devtools'); }
  }, true);
})();
"#;

#[tauri::command]
fn toggle_fullscreen(window: tauri::WebviewWindow) {
    let fs = window.is_fullscreen().unwrap_or(false);
    let _ = window.set_fullscreen(!fs);
}

#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) {
    if window.is_devtools_open() { window.close_devtools(); } else { window.open_devtools(); }
}

fn is_store_build() -> bool {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().to_ascii_lowercase().contains("\\windowsapps\\"))
        .unwrap_or(false)
}

// ---------- 没有 WebView2 运行时 (少数未更新的 Win10) ----------
#[cfg(windows)]
fn ensure_webview2() -> bool {
    use webview2_com::Microsoft::Web::WebView2::Win32::GetAvailableCoreWebView2BrowserVersionString;
    use windows::core::{PCWSTR, PWSTR, HSTRING};
    use windows::Win32::UI::WindowsAndMessaging::*;
    let mut v = PWSTR::null();
    let ok = unsafe { GetAvailableCoreWebView2BrowserVersionString(PCWSTR::null(), &mut v) }.is_ok() && !v.is_null();
    if ok { return true; }
    let text = HSTRING::from("天际航线需要 Microsoft Edge WebView2 运行时 (Windows 11 与已更新的 Windows 10 自带)。\n\n\
本机未检测到 WebView2。点击「是」打开微软官方下载页, 安装后重新启动游戏。\n\n\
SkyRoute needs the Microsoft Edge WebView2 Runtime. Click Yes to open Microsoft's download page, then restart the game.");
    let title = HSTRING::from(TITLE);
    let r = unsafe { MessageBoxW(None, &text, &title, MB_YESNO | MB_ICONWARNING) };
    if r == IDYES {
        let _ = tauri_plugin_opener::open_url("https://developer.microsoft.com/microsoft-edge/webview2/#download", None::<&str>);
    }
    false
}

fn main() {
    // 测试用: skyroute --dump-electron-ls <dir>
    let args: Vec<String> = std::env::args().collect();
    if args.len() >= 3 && args[1] == "--dump-electron-ls" {
        let origin = args.get(3).map(|s| s.as_str()).unwrap_or("app://skyroute");
        let m = read_electron_ls(Path::new(&args[2]), origin);
        println!("{}", serde_json::Value::Object(m));
        return;
    }

    #[cfg(windows)]
    if !ensure_webview2() { return; }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![toggle_fullscreen, toggle_devtools])
        .setup(|app| {
            let base = if cfg!(windows) { "https://tauri.localhost/index.html" } else { "tauri://localhost/index.html" };
            let url = if is_store_build() { format!("{base}?store=1") } else { base.to_string() };
            let mut b = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse().unwrap()))
                .title(TITLE)
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 600.0)
                .center()
                .background_color(tauri::window::Color(0x0b, 0x2a, 0x5b, 0xff))
                .background_throttling(tauri::utils::config::BackgroundThrottlingPolicy::Disabled)
                .use_https_scheme(true)
                .initialization_script(KEYS_SCRIPT)
                .on_navigation(|u| {
                    if is_app_url(u) { true } else { open_external(u.as_str()); false }
                })
                .on_new_window(|u, _features| {
                    open_external(u.as_str());
                    tauri::webview::NewWindowResponse::Deny
                });
            #[cfg(windows)]
            {
                // 与 Electron 默认一致: 音频无需用户手势即可播放
                b = b.additional_browser_args("--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required");
            }
            if let Some(s) = migration_script() { b = b.initialization_script(&s); }
            let w = b.build()?;
            #[cfg(windows)]
            {
                let _ = w.with_webview(|wv| unsafe {
                    use webview2_com::Microsoft::Web::WebView2::Win32::*;
                    use windows::core::Interface;
                    if let Ok(core) = wv.controller().CoreWebView2() {
                        if let Ok(s) = core.Settings() {
                            let _ = s.SetAreDefaultContextMenusEnabled(false);
                            let _ = s.SetIsStatusBarEnabled(false);
                            let _ = s.SetIsZoomControlEnabled(false);
                            if let Ok(s3) = s.cast::<ICoreWebView2Settings3>() {
                                let _ = s3.SetAreBrowserAcceleratorKeysEnabled(false);
                            }
                        }
                    }
                });
            }
            let _ = &w;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SkyRoute");
}
