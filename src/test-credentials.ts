import * as path from 'path';
import { runPowerShell } from './powershell';

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

    try {
        // SECURITY: no shell, full powershell.exe path, password via stdin (see powershell.ts)
        const result = await runPowerShell({
            scriptPath,
            args: ['-Server', server, '-Username', username, '-TestPath', testPath],
            password,
            timeoutMs: 30000  // 30 second timeout
        });

        if (result.timedOut) {
            return { success: false, message: `Connection to ${server} timed out after 30 seconds.` };
        }

        const output = result.stdout.trim();

        if (result.exitCode === 0 && output.startsWith('SUCCESS')) {
            return {
                success: true,
                message: 'Credentials verified successfully'
            };
        }

        const message = (output || result.stderr.trim() || `Exit code ${result.exitCode}`).replace('FAILED: ', '');
        return { success: false, message };
    } catch (error: any) {
        return {
            success: false,
            message: `Connection failed: ${error.message}`
        };
    }
}
