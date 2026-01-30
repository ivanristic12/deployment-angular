import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface PrepareConfigParams {
    appName: string;
    defaultConfiguration: string;
    workspaceRoot: string;
}

/**
 * Prepares the configuration file for Angular application deployment
 * Checks for newer Angular structure (dist/{appname}/browser) or older (dist/{name})
 * Copies the environment-specific configuration to dist and removes extra config files
 */
export async function prepareConfig(params: PrepareConfigParams): Promise<void> {
    const { appName, defaultConfiguration, workspaceRoot } = params;

    // Determine dist path - check if browser folder exists (newer Angular) or use older structure
    const distPathNew = path.resolve(workspaceRoot, `dist/${appName}/browser`);
    const distPathOld = path.resolve(workspaceRoot, `dist/${appName}`);
    
    const distPath = fs.existsSync(distPathNew) ? distPathNew : distPathOld;
    
    if (!fs.existsSync(distPath)) {
        throw new Error(`❌ Dist folder not found at: ${distPath}`);
    }

    const distAssetsPath = path.join(distPath, 'assets/configuration');
    const sourceConfigPath = path.resolve(workspaceRoot, `src/assets/configuration/configuration.${defaultConfiguration}.json`);
    const targetConfigPath = path.join(distAssetsPath, 'configuration.json');

    // Validate source config exists
    if (!fs.existsSync(sourceConfigPath)) {
        throw new Error(`❌ Source config file not found: ${sourceConfigPath}`);
    }

    // Validate dist assets folder exists
    if (!fs.existsSync(distAssetsPath)) {
        throw new Error(`❌ Dist assets folder not found: ${distAssetsPath}`);
    }

    // Copy env config to dist assets folder
    fs.copyFileSync(sourceConfigPath, targetConfigPath);
    vscode.window.showInformationMessage(`✅ Overwritten dist config with configuration.${defaultConfiguration}.json`);

    // Remove extra configuration files
    const keepFile = 'configuration.json';

    fs.readdir(distAssetsPath, (err, files) => {
        if (err) {
            console.error('Failed to read assets directory:', err);
            vscode.window.showWarningMessage(`Failed to read assets directory: ${err.message}`);
            return;
        }

        files.forEach(file => {
            if (file.startsWith('configuration.') && file !== keepFile) {
                const fullPath = path.join(distAssetsPath, file);
                fs.unlink(fullPath, err => {
                    if (err) {
                        console.warn(`Failed to delete ${file}:`, err.message);
                    } else {
                        console.log(`Deleted extra config file: ${file}`);
                    }
                });
            }
        });
    });
}
