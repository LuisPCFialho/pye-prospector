use tauri_plugin_sql::{Migration, MigrationKind};

/// Only allow http/https URLs. Rejects javascript:/file:/data: and anything
/// containing control characters or whitespace that could break argument passing.
fn is_safe_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return false;
    }
    // Reject control chars and whitespace (newlines, tabs) that could enable injection.
    !url.chars().any(|c| c.is_control() || c == '\n' || c == '\r')
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !is_safe_url(&url) {
        return Err("URL não permitido (apenas http/https)".into());
    }
    #[cfg(target_os = "windows")]
    {
        // rundll32 receives the URL as a single argument — no cmd.exe shell
        // re-parsing, so '&' in Google Maps URLs is preserved and shell
        // metacharacter injection is not possible.
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "scoring_notes_tasks",
            sql: include_str!("../migrations/0002_scoring_notes_tasks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "missing_fields_flagged_dropreason_email",
            sql: include_str!("../migrations/0003_missing_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "crm_features_territories_activities_contacts_followups",
            sql: include_str!("../migrations/0004_crm_features.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "performance_indexes",
            sql: include_str!("../migrations/0005_indexes.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pye_prospector.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![open_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
