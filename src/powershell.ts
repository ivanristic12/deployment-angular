import { spawn } from 'child_process';
import * as os from 'os';
import * as path from 'path';

/**
 * Full path to Windows PowerShell.
 * SECURITY: never start "powershell.exe" by bare name - Windows/libuv would search the
 * working directory (the workspace folder) first, so a planted powershell.exe in a
 * repository would be executed and receive the password.
 */
export function getPowerShellPath(): string {
    const systemRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
    return path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

export interface PowerShellRunOptions {
    /** Absolute path to the .ps1 script */
    scriptPath: string;
    /** Script parameters, e.g. ['-Server', 'srv1']. Passed as an argument array, no shell involved. */
    args: string[];
    /** Password - sent via stdin, NEVER on the command line */
    password: string;
    /** Called for every chunk of stdout/stderr output */
    onOutput?: (text: string) => void;
    /** Kill the process after this many milliseconds */
    timeoutMs?: number;
}

export interface PowerShellRunResult {
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
}

/**
 * Runs a PowerShell script safely:
 *  - full path to powershell.exe (no PATH / current directory lookup)
 *  - no shell (arguments are passed as an array, so values can't inject commands)
 *  - the password is written to stdin as one base64 line (UTF-16LE bytes), so it never
 *    appears in the process command line, process lists, event logs or transcripts.
 */
export function runPowerShell(options: PowerShellRunOptions): Promise<PowerShellRunResult> {
    return new Promise((resolve, reject) => {
        const psArgs = [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-File', options.scriptPath,
            ...options.args
        ];

        const child = spawn(getPowerShellPath(), psArgs, {
            cwd: os.tmpdir(),     // never run from the workspace folder
            windowsHide: true,
            shell: false
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let timer: NodeJS.Timeout | undefined;

        if (options.timeoutMs) {
            timer = setTimeout(() => {
                timedOut = true;
                child.kill();
            }, options.timeoutMs);
        }

        child.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            options.onOutput?.(text);
        });

        child.stderr.on('data', (data: Buffer) => {
            const text = data.toString();
            stderr += text;
            options.onOutput?.(text);
        });

        child.on('error', (err) => {
            if (timer) { clearTimeout(timer); }
            reject(err);
        });

        child.on('close', (code) => {
            if (timer) { clearTimeout(timer); }
            resolve({ exitCode: code, stdout, stderr, timedOut });
        });

        // Send the password via stdin and close it
        const passwordBuffer = Buffer.from(options.password ?? '', 'utf16le');
        const line = passwordBuffer.toString('base64') + '\r\n';
        passwordBuffer.fill(0);
        child.stdin.on('error', () => { /* process may have exited early */ });
        child.stdin.end(line, 'ascii');
    });
}
