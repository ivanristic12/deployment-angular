import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildProject } from './build-project';
import { prepareConfig } from './prepare-config';
import { testCredentials } from './test-credentials';
import { deployProject } from './deploy-project';

export function activate(context: vscode.ExtensionContext) {
    // Create a status bar button
    const deployButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    deployButton.text = '$(rocket) Deploy';
    deployButton.tooltip = 'Deploy Project';
    deployButton.command = 'extension.deployProject';
    deployButton.show();

    context.subscriptions.push(deployButton);

    // Register command
    const disposable = vscode.commands.registerCommand('extension.deployProject', async () => {
        // Check workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open!');
            return;
        }

        const projectRoot = workspaceFolders[0].uri.fsPath;
        const configPath = path.join(projectRoot, 'deploy.config.json');

        // Create config file if it doesn't exist
        if (!fs.existsSync(configPath)) {
            const template = {
                server: "",
                poolName: "",
                appFolderLocation: "",
                backupFolderLocation: "",
                excludeFromCleanup: "",
                excludeFromCopy: "",
                jsonConfiguration: false,
                defaultConfiguration: ""
            };
            fs.writeFileSync(configPath, JSON.stringify(template, null, 4));
            vscode.window.showWarningMessage(
                'deploy.config.json has been created. Please fill in the configuration parameters and try again.',
                'Open Config'
            ).then(selection => {
                if (selection === 'Open Config') {
                    vscode.workspace.openTextDocument(configPath).then(doc => {
                        vscode.window.showTextDocument(doc);
                    });
                }
            });
            return;
        }

        // Read existing config
        const configContent = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        // Create output channel for logging
        const outputChannel = vscode.window.createOutputChannel('Deploy');

        // Create and show webview panel
        const panel = vscode.window.createWebviewPanel(
            'deployForm',
            'Deploy Project',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        // Set HTML content
        panel.webview.html = getWebviewContent(config.defaultConfiguration || '');

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'deploy') {
                    outputChannel.clear();
                    outputChannel.show();
                    
                    // Look for environment-specific config first (e.g., deploy.production.config.json)
                    // If not found, use default deploy.config.json
                    const envConfigPath = path.join(projectRoot, `deploy.${message.configuration}.config.json`);
                    const defaultConfigPath = path.join(projectRoot, 'deploy.config.json');
                    
                    let deployConfig;
                    let usedConfigPath;
                    
                    if (fs.existsSync(envConfigPath)) {
                        usedConfigPath = envConfigPath;
                        const envConfigContent = fs.readFileSync(envConfigPath, 'utf-8');
                        deployConfig = JSON.parse(envConfigContent);
                        outputChannel.appendLine(`Using environment-specific config: deploy.${message.configuration}.config.json`);
                    } else {
                        usedConfigPath = defaultConfigPath;
                        deployConfig = config; // Use already loaded default config
                        outputChannel.appendLine(`Using default config: deploy.config.json`);
                    }
                    
                         const fullUsername = 
                         message.username;

                    outputChannel.appendLine('=== Deploy Configuration ===');
                    outputChannel.appendLine(`Config File: ${path.basename(usedConfigPath)}`);

                    // Test credentials first
                    outputChannel.appendLine('\n=== Testing Credentials ===');
                    try {
                        const credTestResult = await testCredentials({
                            server: deployConfig.server,
                            username: fullUsername,
                            password: message.password,
                            testPath: deployConfig.appFolderLocation
                        });

                        if (!credTestResult.success) {
                            outputChannel.appendLine(`❌ Credential test failed: ${credTestResult.message}`);
                            
                            // Send error message back to webview to show in form
                            panel.webview.postMessage({
                                command: 'credentialError',
                                message: credTestResult.message
                            });
                            return;
                        }

                        outputChannel.appendLine(`✅ Credentials verified successfully`);
                    } catch (error: any) {
                        outputChannel.appendLine(`❌ Credential test error: ${error.message}`);
                        
                        // Send error message back to webview
                        panel.webview.postMessage({
                            command: 'credentialError',
                            message: error.message
                        });
                        return;
                    }

                    // Close panel only after credentials are verified
                    panel.dispose();

                    // Build the project
                    outputChannel.appendLine('\n=== Building Project ===');
                    try {
                        await buildProject({
                            configuration: message.configuration,
                            workspaceRoot: projectRoot
                        });
                    } catch (error: any) {
                        outputChannel.appendLine(`\n=== Build Failed ===`);
                        outputChannel.appendLine(error.message);
                        return;
                    }

                    outputChannel.appendLine('\n=== Build Completed ===');

                    // Read package.json to get app name
                    const packageJsonPath = path.join(projectRoot, 'package.json');
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                    const appName = packageJson.name;

                    // Prepare config if jsonConfiguration is enabled
                    if (deployConfig.jsonConfiguration) {
                        try {
                            await prepareConfig({
                                appName: appName,
                                defaultConfiguration: message.configuration,
                                workspaceRoot: projectRoot
                            });
                            outputChannel.appendLine('\n=== Config Preparation Completed ===');
                        } catch (error: any) {
                            outputChannel.appendLine(`\n=== Config Preparation Failed ===`);
                            outputChannel.appendLine(error.message);
                            return;
                        }
                    }

                    // Deploy the project
                    outputChannel.appendLine('\n=== Deploying Project ===');
                    try {
                        await deployProject({
                            username: fullUsername,
                            password: message.password,
                            server: deployConfig.server,
                            poolName: deployConfig.poolName,
                            appFolderLocation: deployConfig.appFolderLocation,
                            backupFolderLocation: deployConfig.backupFolderLocation,
                            excludeFromCleanup: deployConfig.excludeFromCleanup || '',
                            excludeFromCopy: deployConfig.excludeFromCopy || '',
                            workspaceRoot: projectRoot,
                            appName: appName,
                            outputChannel: outputChannel
                        });
                        // Success message is shown by deployProject function
                    } catch (error: any) {
                        outputChannel.appendLine(error.message);
                        return;
                    }
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function ensureDeployConfig() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const projectRoot = workspaceFolders[0].uri.fsPath;
    const configPath = path.join(projectRoot, 'deploy.config.json');

    if (!fs.existsSync(configPath)) {
        const template = {
            server: "",
            poolName: "",
            appFolderLocation: "",
            backupFolderLocation: "",
            excludeFromCleanup: "",
            excludeFromCopy: "",
            jsonConfiguration: false,
            defaultConfiguration: ""
        };
        fs.writeFileSync(configPath, JSON.stringify(template, null, 4));
        vscode.window.showInformationMessage('deploy.config.json created!');
    }
}

function getWebviewContent(defaultConfig: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Deploy Project</title>
            <style>
                body {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .container {
                    width: 100%;
                    max-width: 400px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                label {
                    font-size: 13px;
                    font-weight: 500;
                }
                input {
                    padding: 8px 12px;
                    font-size: 13px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    outline: none;
                }
                input:focus {
                    border-color: var(--vscode-focusBorder);
                }
                button {
                    padding: 10px 20px;
                    font-size: 13px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    margin-top: 10px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                button:active {
                    transform: translateY(1px);
                }
                .error-message {
                    padding: 12px;
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    color: #ffffff;
                    border-radius: 2px;
                    font-size: 13px;
                    display: none;
                }
                .error-message.show {
                    display: block;
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div id="errorMessage" class="error-message"></div>
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" placeholder="Enter username" autofocus />
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="Enter password" />
                </div>
                <div class="form-group">
                    <label for="configuration">Configuration</label>
                    <input type="text" id="configuration" placeholder="Enter configuration" value="${defaultConfig}" />
                </div>
                <button id="deployBtn">Deploy</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const usernameInput = document.getElementById('username');
                const passwordInput = document.getElementById('password');
                const configurationInput = document.getElementById('configuration');
                const deployBtn = document.getElementById('deployBtn');
                const errorMessage = document.getElementById('errorMessage');

                // Listen for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'credentialError') {
                        // Show error message
                        errorMessage.innerHTML = '<span style="color: #f48771;">❌</span> Credential Error: ' + message.message;
                        errorMessage.classList.add('show');
                        deployBtn.disabled = false;
                        deployBtn.textContent = 'Deploy';
                    }
                });

                function deploy() {
                    // Clear previous error
                    errorMessage.classList.remove('show');
                    
                    // Disable button and show loading state
                    deployBtn.disabled = true;
                    deployBtn.textContent = 'Verifying credentials...';
                    
                    vscode.postMessage({
                        command: 'deploy',
                        username: usernameInput.value,
                        password: passwordInput.value,
                        configuration: configurationInput.value
                    });
                }

                deployBtn.addEventListener('click', deploy);

                // Allow Enter key to submit
                document.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        deploy();
                    }
                });
            </script>
        </body>
        </html>
    `;
}

export function deactivate() {}
