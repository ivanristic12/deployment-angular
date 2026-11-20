import * as vscode from 'vscode';
import { runPowerShell } from './powershell';
import * as path from 'path';
import * as fs from 'fs';

interface DeployProjectParams {
    username: string;
    password: string;
    server: string;
    poolName: string;
    appFolderLocation: string;
    backupFolderLocation: string;
    excludeFromCleanup: string;
    excludeFromCopy: string;
    workspaceRoot: string;
    appName: string;
    outputChannel?: vscode.OutputChannel;
}

/**
 * Deploys the built Angular application to the remote server using PowerShell script
 */
export async function deployProject(params: DeployProjectParams): Promise<void> {
    const {
        username,
        password,
        server,
        poolName,
        appFolderLocation,
        backupFolderLocation,
        excludeFromCleanup,
        excludeFromCopy,
        workspaceRoot,
        appName
    } = params;

    // Determine the dist path - check for browser folder (newer Angular) or older structure
    const distPathNew = path.resolve(workspaceRoot, `dist/${appName}/browser`);
    const distPathOld = path.resolve(workspaceRoot, `dist/${appName}`);
    
    const newFilesPath = fs.existsSync(distPathNew) ? distPathNew : distPathOld;

    if (!fs.existsSync(newFilesPath)) {
        throw new Error(`Build output not found at: ${newFilesPath}`);
    }

    // Get the path to the deploy.bat wrapper script
    const batScriptPath = path.join(__dirname, '..', 'scripts', 'deploy.bat');
    const psScriptPath = path.join(__dirname, '..', 'scripts', 'deploy-template.ps1');

    // Check if script exists
    if (!fs.existsSync(psScriptPath)) {
        throw new Error(`PowerShell script not found at: ${psScriptPath}`);
    }

    {
        // Build script arguments array (no shell, no quoting issues).
        // SECURITY: the password is NOT an argument - runPowerShell sends it via stdin.
        const psArgs = [
            '-Username', username,
            '-Server', server,
            '-AppPoolName', poolName,
            '-AppFolderLocation', appFolderLocation,
            '-NewFilesPath', newFilesPath,
            '-BackupFolder', backupFolderLocation
        ];

        // Add exclude arrays if they exist
        if (excludeFromCleanup && excludeFromCleanup.trim()) {
            const excludeItems = excludeFromCleanup.split(',').map(s => s.trim());
            psArgs.push('-ExcludeFromCleanup', excludeItems.join(','));
        }
        if (excludeFromCopy && excludeFromCopy.trim()) {
            const excludeItems = excludeFromCopy.split(',').map(s => s.trim());
            psArgs.push('-ExcludeFromCopy', excludeItems.join(','));
        }

        let code: number | null;
        try {
            // SECURITY: full powershell.exe path, no shell, password via stdin (see powershell.ts)
            const result = await runPowerShell({
                scriptPath: psScriptPath,
                args: psArgs,
                password,
                onOutput: (output) => params.outputChannel?.append(output)
            });
            code = result.exitCode;
        } catch (error: any) {
            params.outputChannel?.appendLine(`\nProcess Error: ${error.message}`);
            throw error;
        }

        params.outputChannel?.appendLine(`\n--- Deployment Process Finished (Exit Code: ${code}) ---`);

        // code === null means the process was killed - that is NOT a success
        if (code === 0) {
            params.outputChannel?.appendLine('\n=== Deployment Completed Successfully ===');
            vscode.window.showInformationMessage('✅ Deployment completed successfully!');
        } else {
            const errorMsg = `Deployment failed with exit code ${code}`;
            params.outputChannel?.appendLine(`\n=== Deployment Failed ===`);
            vscode.window.showErrorMessage(errorMsg);
            throw new Error(errorMsg);
        }
    }
}
