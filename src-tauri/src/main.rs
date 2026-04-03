fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_macos_permissions::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
