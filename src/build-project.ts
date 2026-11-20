import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BuildProjectParams {
    configuration: string;
    workspaceRoot: string;
}

/**
 * Builds the Angular project with the specified configuration
 * Uses double dash syntax for npm arguments
 */
export async function buildProject(params: BuildProjectParams): Promise<void> {
    const { configuration, workspaceRoot } = params;

    // SECURITY: the value is placed on a shell command line (npm.cmd requires a shell on Windows),
    // so only allow a plain configuration name - no spaces, quotes, &, |, etc.
    if (!configuration || !/^[A-Za-z0-9_\-.]+$/.test(configuration)) {
        const msg = `Invalid "configuration" in deploy config: "${configuration}". Use only letters, digits, '-', '_' and '.'.`;
        vscode.window.showErrorMessage(msg);
        throw new Error(msg);
    }

    vscode.window.showInformationMessage(`🔨 Building project with configuration: ${configuration}`);

    const command = `npm run build -- --configuration=${configuration}`;
    console.log(`Executing build command: ${command}`);

    try {
        const { stdout, stderr } = await execAsync(command, { 
            cwd: workspaceRoot,
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large build outputs
        });

        if (stdout) {
            console.log(stdout);
        }
        if (stderr) {
            console.error(stderr);
        }

        vscode.window.showInformationMessage(`✅ Build completed successfully with configuration: ${configuration}`);
    } catch (error: any) {
        const errorMessage = `❌ Build failed: ${error.message}`;
        vscode.window.showErrorMessage(errorMessage);
        throw error;
    }
}
