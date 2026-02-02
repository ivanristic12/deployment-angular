# Deploy to IIS

Your friendly deployment assistant for Angular applications to Windows IIS servers via PowerShell remoting.

## Features

- 🚀 **One-Click Deploy** - Deploy Angular apps to IIS with a single button click
- 🔐 **Secure Credentials** - Test credentials before deployment to avoid account lockouts
- 📦 **Smart Backup** - Automatic backup before deployment with rollback capability
- ⚙️ **Flexible Configuration** - Support for multiple environments (dev, staging, production)
- 🎯 **Selective Deployment** - Exclude specific files from cleanup or copy operations
- 📊 **Real-time Logging** - Watch deployment progress in the output panel

## Requirements

- **Local Machine:**
  - Windows OS with PowerShell 5.1 or higher
  - Visual Studio Code
  - Angular CLI project

- **Remote Server:**
  - Windows Server with IIS installed
  - PowerShell Remoting (WinRM) enabled
  - Administrator credentials

## Getting Started

### 1. Install Extension

Install Deploy to IIS from the VS Code marketplace or from a `.vsix` file.

### 2. Configure Deployment

Click the 🚀 **Deploy** button in the status bar. On first run, a `deploy.config.json` file will be created in your project root.

Edit the configuration with your server details:

```json
{
    "server": "your-server-name",
    "poolName": "YourAppPoolName",
    "appFolderLocation": "c:\\inetpub\\wwwroot\\YourApp",
    "backupFolderLocation": "c:\\backup\\YourApp",
    "excludeFromCleanup": "",
    "excludeFromCopy": "",
    "jsonConfiguration": false,
    "configuration": "production"
}
```

### 3. Deploy

1. Click the 🚀 **Deploy** button
2. Enter your credentials (username and password)
3. Select configuration environment
4. Watch the deployment progress!

## Configuration Options

| Option | Description |
|--------|-------------|
| `server` | Target server hostname or IP |
| `poolName` | IIS Application Pool name |
| `appFolderLocation` | Target folder on remote server (use double backslashes) |
| `backupFolderLocation` | Backup location on remote server |
| `excludeFromCleanup` | Comma-separated files/folders to preserve (e.g., "web.config,uploads") |
| `excludeFromCopy` | Comma-separated files to skip during copy |
| `jsonConfiguration` | Enable environment-specific config transformation | Configuration jsons need to be under src/assets/configuration, in form configuration.json, configuration.{environment}.json. Same as for environment.
| `configuration` |  Environment to deploy |

## Multiple Environments

Create environment-specific configs:
- `deploy.production.config.json`
- `deploy.staging.config.json`
- `deploy.development.config.json`

Each can have different server settings. The extension will automatically use the matching config based on your selection.

## How It Works

1. **Build** - Compiles your Angular app for the selected environment
2. **Test Credentials** - Verifies server connection and permissions
3. **Stop App Pool** - Safely stops IIS application pool
4. **Backup** - Creates timestamped backup of current deployment
5. **Deploy** - Copies new files to server
6. **Start App Pool** - Restarts the application
7. **Verify** - Confirms deployment success

If anything fails, automatic rollback restores the previous version.

## Troubleshooting

### "Access Denied" or Connection Errors

- Ensure WinRM is enabled on the server: `winrm quickconfig`
- Username without domain: `username`
- Verify you have admin rights on the remote server
- Check firewall allows ports 5985 (HTTP) or 5986 (HTTPS)

### Account Lockout

The extension tests credentials before deployment to prevent lockouts. If locked:
- Wait for your IT policy timeout (usually 15-30 minutes)
- Verify correct username format and password
- Contact your IT admin if needed

### Path Errors

- Use double backslashes in paths: `c:\\inetpub\\wwwroot`
- Ensure paths exist on the remote server
- Verify admin share access (e.g., `\\server\c$`)

## Release Notes

### 1.0.0

Initial release of Deploy to IIS
- One-click deployment to IIS
- Credential testing
- Automatic backups and rollback
- Multi-environment support

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

---

**Enjoy deploying with Deploy to IIS! 🚀**
