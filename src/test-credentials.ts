import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

interface TestCredentialsParams {
    server: string;
    username: string;
    password: string;
    testPath: string;  // AppFolderLocation from deploy.config.json
}

/**
 * Tests credentials by attempting to connect to the remote server
 * Returns true if credentials are valid, false otherwise
 */
export async function testCredentials(params: TestCredentialsParams): Promise<{ success: boolean; message: string }> {
    const { server, username, password, testPath } = params;

    // Get the path to the test-credentials.ps1 script
    const scriptPath = path.join(__dirname, '..', 'scripts', 'test-credentials.ps1');

    // Escape password for PowerShell - use base64 encoding to avoid special character issues
    const passwordBuffer = Buffer.from(password, 'utf16le');
    const passwordBase64 = passwordBuffer.toString('base64');

    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -Server "${server}" -Username "${username}" -PasswordBase64 "${passwordBase64}" -TestPath "${testPath}"`;

    try {
        const { stdout, stderr } = await execAsync(command, {
            timeout: 30000  // 30 second timeout
        });

        const output = stdout.trim();

        if (output.startsWith('SUCCESS')) {
            return { 
                success: true, 
                message: 'Credentials verified successfully' 
            };
        } else {
            return { 
                success: false, 
                message: output.replace('FAILED: ', '') 
            };
        }
    } catch (error: any) {
        // Parse error output
        const errorOutput = error.stdout || error.message;
        
        if (errorOutput.includes('FAILED:')) {
            return { 
                success: false, 
                message: errorOutput.replace('FAILED: ', '').trim() 
            };
        }
        
        return { 
            success: false, 
            message: `Connection failed: ${error.message}` 
        };
    }
}
