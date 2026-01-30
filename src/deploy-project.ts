import * as vscode from 'vscode';
import { spawn } from 'child_process';
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

    return new Promise<void>((resolve, reject) => {
        // Encode password as base64 to avoid special character issues
        const passwordBuffer = Buffer.from(password, 'utf16le');
        const passwordBase64 = passwordBuffer.toString('base64');
        
        // Get the PowerShell script path directly (skip batch file wrapper)
        const psScriptPath = path.join(__dirname, '..', 'scripts', 'deploy-template.ps1');
        
        // Build PowerShell arguments array (no quotes needed with array syntax)
        const psArgs = [
            '-ExecutionPolicy', 'Bypass',
            '-File', psScriptPath,
            '-Username', username,
            '-PasswordBase64', passwordBase64,
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

        // Spawn PowerShell directly with argument array (avoids quote escaping issues)
        const process = spawn('powershell.exe', psArgs, {
            cwd: workspaceRoot
        });

        // Capture stdout
        process.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(output);
            if (params.outputChannel) {
                params.outputChannel.append(output);
            }
        });

        // Capture stderr
        process.stderr.on('data', (data) => {
            const output = data.toString();
            console.log('stderr:', output);
            if (params.outputChannel) {
                params.outputChannel.append(output);
            }
        });

        // Handle process completion
        process.on('close', (code) => {
            if (params.outputChannel) {
                params.outputChannel.appendLine(`\n--- Deployment Process Finished (Exit Code: ${code}) ---`);
            }
            
            if (code === 0 || code === null) {
                if (params.outputChannel) {
                    params.outputChannel.appendLine('\n=== Deployment Completed Successfully ===');
                }
                vscode.window.showInformationMessage('✅ Deployment completed successfully!');
                resolve();
            } else {
                const errorMsg = `Deployment failed with exit code ${code}`;
                if (params.outputChannel) {
                    params.outputChannel.appendLine(`\n=== Deployment Failed ===`);
                }
                vscode.window.showErrorMessage(errorMsg);
                reject(new Error(errorMsg));
            }
        });

        // Handle process errors
        process.on('error', (error) => {
            console.error('Process error:', error);
            if (params.outputChannel) {
                params.outputChannel.appendLine(`\nProcess Error: ${error.message}`);
            }
            reject(error);
        });
    });
}
