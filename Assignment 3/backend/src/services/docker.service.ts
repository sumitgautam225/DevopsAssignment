import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export class DockerService {
    private workDir: string;

    constructor() {
        this.workDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(this.workDir)) fs.mkdirSync(this.workDir, { recursive: true });
    }

    private detectPackageManager(repoDir: string): { type: 'npm' | 'yarn' | 'pnpm'; lockFile: string } {
        if (fs.existsSync(path.join(repoDir, 'pnpm-lock.yaml'))) {
            return { type: 'pnpm', lockFile: 'pnpm-lock.yaml' };
        }
        if (fs.existsSync(path.join(repoDir, 'yarn.lock'))) {
            return { type: 'yarn', lockFile: 'yarn.lock' };
        }
        return { type: 'npm', lockFile: 'package-lock.json' };
    }

    private validateDockerfile(dockerfile: string, repoDir: string): { valid: boolean; missingFiles: string[] } {
        const missingFiles: string[] = [];
        const copyMatches = dockerfile.matchAll(/COPY\s+(?!--from=)(?:--chown=[\w:]+\s+)?([^\s]+)\s+([^\s]+)/g);

        // Detect package manager before validation
        const { type: pkgManager, lockFile } = this.detectPackageManager(repoDir);

        for (const match of copyMatches) {
            const sourcePath = match[1];
            // Skip special cases
            if (sourcePath.includes('*')) continue;
            if (sourcePath.includes('--from=')) continue;
            if (sourcePath === 'nginx.conf') continue;

            // Handle lock files based on detected package manager
            if (['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(sourcePath)) {
                if (sourcePath === lockFile) {
                    // Only check for the detected package manager's lock file
                    const fullPath = path.join(repoDir, lockFile);
                    if (!fs.existsSync(fullPath)) {
                        missingFiles.push(lockFile);
                    }
                }
                continue;
            }

            const fullPath = path.join(repoDir, sourcePath);
            if (!fs.existsSync(fullPath)) {
                missingFiles.push(sourcePath);
            }
        }

        return {
            valid: missingFiles.length === 0,
            missingFiles
        };
    }

    private async writeRequiredFiles(repoDir: string, techStack: string): Promise<void> {
        // Add any necessary config files based on tech stack
        const nginxConf = `
server {
    listen 80;
    server_name _;
    
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
}`;

        switch (techStack) {
            case 'Next.js':
                // For Next.js, we'll use its built-in server
                break;
            case 'React':
                // For React SPA, we need nginx config
                fs.writeFileSync(path.join(repoDir, 'nginx.conf'), nginxConf);
                break;
            // Add other tech stacks as needed
        }
    }

    private async callGemini(prompt: string): Promise<string> {
        const apiKey = process.env.GEMINI_API_KEY;
        const configuredUrl = process.env.GEMINI_API_URL || 'https://generative.googleapis.com/v1/models/gemini-1.0:generate';
        if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

        const body = JSON.stringify({ prompt, maxOutputTokens: 512 });

        // Option: allow using API key as a query param when some environments require it
        const useKeyQuery = String(process.env.GEMINI_USE_KEY_QUERY || 'false').toLowerCase() === 'true';

        return new Promise<string>((resolve, reject) => {
            try {
                const parsed = new URL(configuredUrl);

                // If configured to use key as query param, append it
                if (useKeyQuery) {
                    parsed.searchParams.set('key', apiKey);
                }

                const options: any = {
                    hostname: parsed.hostname,
                    path: parsed.pathname + parsed.search,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body),
                    },
                };

                // If not using key query, send as Bearer token (recommended for service-account based tokens)
                if (!useKeyQuery) {
                    options.headers.Authorization = `Bearer ${apiKey}`;
                }

                const req = https.request(options, (res) => {
                    const status = res.statusCode || 0;
                    const contentType = res.headers['content-type'] || '';
                    let data = '';
                    res.on('data', (chunk) => (data += chunk));
                    res.on('end', () => {
                        // If response isn't JSON, surface the raw body to help debugging (HTML error pages etc.)
                        const isJson = contentType.includes('application/json') || data.trim().startsWith('{') || data.trim().startsWith('[');
                        if (!isJson) {
                            const fullUrl = parsed.toString();
                            const errMsg = `Non-JSON response from Gemini endpoint (status=${status}, content-type=${contentType}) for URL ${fullUrl}. Response body: ${data}`;
                            // Add troubleshooting hint for common 404: wrong model name or endpoint, or API not enabled
                            const hint = `Check GEMINI_API_URL (${process.env.GEMINI_API_URL || configuredUrl}), ensure the Generative Language API is enabled in Google Cloud, and that your model path is correct.`;
                            reject(new Error(`${errMsg}\nHint: ${hint}`));
                            return;
                        }

                        try {
                            const json = JSON.parse(data);
                            // Try common response shapes
                            if (json?.candidates && Array.isArray(json.candidates) && json.candidates[0]?.content) {
                                resolve(json.candidates[0].content);
                                return;
                            }
                            if (json?.outputs && Array.isArray(json.outputs) && json.outputs[0]?.content) {
                                resolve(typeof json.outputs[0].content === 'string' ? json.outputs[0].content : JSON.stringify(json.outputs[0].content));
                                return;
                            }
                            if (json?.choices && Array.isArray(json.choices) && json.choices[0]?.message?.content) {
                                const content = json.choices[0].message.content;
                                if (typeof content === 'string') resolve(content);
                                else if (Array.isArray(content)) resolve(content.map((c: any) => c.text || '').join(''));
                                else resolve(JSON.stringify(content));
                                return;
                            }
                            // Fallback: stringify the whole object
                            resolve(JSON.stringify(json));
                        } catch (err) {
                            reject(err);
                        }
                    });
                });

                req.on('error', (err) => {
                    const fullUrl = parsed.toString();
                    reject(new Error(`Request error to Gemini URL ${fullUrl}: ${err.message}`));
                });
                req.write(body);
                req.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    private async generateDockerfileForReact(repoDir: string): Promise<string> {
        const { type: pkgManager, lockFile } = this.detectPackageManager(repoDir);
        
        // Determine build output directory
        const pkgJson = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
        const buildDir = pkgJson.scripts?.build?.includes('vite') ? 'dist' : 'build';
        
        // Get install command based on package manager
        const getInstallCmd = () => {
            switch (pkgManager) {
                case 'pnpm': return 'pnpm install --frozen-lockfile';
                case 'yarn': return 'yarn install --frozen-lockfile';
                default: return 'npm ci';
            }
        };

        return `FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json ${lockFile ? lockFile : ''} ./
RUN ${getInstallCmd()}

# Copy source files and build
COPY . .
RUN npm run build

FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy build output from builder stage
COPY --from=builder /app/${buildDir} .

# Copy nginx configuration
RUN echo 'server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
    }

    async generateDockerfile(techStack: string, repoDir: string): Promise<string> {
        let data: string | undefined;
        if (process.env.GEMINI_API_KEY) {
            const prompt = `You are an expert DevOps engineer. Generate a production-ready Dockerfile for a ${techStack} application. Requirements:
- Use multi-stage builds to minimize image size
- For React SPAs, use nginx to serve the built files
- For Next.js, use the standalone output
- Include only necessary files in each stage
- Set proper permissions and non-root user
- No volumes or host path mounts
- Respond ONLY with the Dockerfile content, no explanation or markdown or backtik.`;

            // try {
            //     const response = await this.callGemini(prompt);
            //     if (response && response.trim().startsWith('FROM')) {
            //         console.log('Using AI-generated Dockerfile');
            //         return response.trim();
            //     }
            // } catch (err) {
            //     console.error('Gemini generation failed, falling back to templates:', err);
            // }
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });
            console.log(response.text);
            data = response.text;
        }
        if (data) {
            return data;
        }
        
        // Fallback templates with best practices
        console.log('Using fallback template for', techStack);
        // Get package manager info before generating Dockerfile
        const { type: pkgManager, lockFile } = this.detectPackageManager(repoDir);
        
        const getInstallCommand = (manager: 'npm' | 'yarn' | 'pnpm') => {
            switch (manager) {
                case 'pnpm': return 'pnpm install --frozen-lockfile';
                case 'yarn': return 'yarn install --frozen-lockfile';
                default: return 'npm ci';
            }
        };

        switch (techStack) {
            case 'Next.js':
                return `# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json ${lockFile} ./
RUN ${getInstallCommand(pkgManager)}

# Copy source files
COPY . .

# Build application
RUN ${pkgManager} run build

# Production stage
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]`;

            case 'React':
                return this.generateDockerfileForReact(repoDir);

            default:
                throw new Error('Unsupported tech stack');
        }
    }

    async buildImage(dockerfile: string, repoDir: string): Promise<void> {
        try {
            if (await this.detectTechStack(repoDir) === 'Next.js') {
                this.validateNextJsProject(repoDir);
            }
            // Validate Dockerfile syntax (basic check)
            if (!dockerfile.includes('FROM ')) {
                throw new Error('Invalid Dockerfile: missing FROM instruction');
            }

            // Write Dockerfile
            fs.writeFileSync(path.join(repoDir, 'Dockerfile'), dockerfile);

            // Detect tech stack from package.json for config generation
            const techStack = await this.detectTechStack(repoDir);

            // Write any required config files
            await this.writeRequiredFiles(repoDir, techStack);

            // Validate all required files exist
            const validation = this.validateDockerfile(dockerfile, repoDir);
            if (!validation.valid) {
                throw new Error(`Missing required files: ${validation.missingFiles.join(', ')}`);
            }

            try {
                // Test if docker daemon is running first
                execSync('docker ps', { stdio: 'pipe' });
            } catch (err) {
                throw new Error('Docker daemon is not running. Start Docker Desktop or docker service first.');
            }

            // Capture build output and errors
            const buildResult = spawnSync('docker', ['build', '-t', 'app:latest', '.'], {
                cwd: repoDir,
                encoding: 'utf-8',
                stdio: 'pipe'
            });

            if (buildResult.status !== 0) {
                const errorOutput = buildResult.stderr || buildResult.stdout || 'No error output';
                console.error('Docker build failed with output:', errorOutput);
                throw new Error(`Docker build failed: ${errorOutput}`);
            }

            console.log('Docker build succeeded');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Build error:', errorMessage);
            throw new Error(`Failed to build Docker image: ${errorMessage}`);
        }
    }

    async cloneRepository(url: string, token?: string): Promise<string> {
        const repoDir = path.join(this.workDir, Date.now().toString());
        fs.mkdirSync(repoDir, { recursive: true });
        try {
            const githubToken = token || process.env.GITHUB_PAT;
            if (!githubToken) {
                throw new Error('GitHub token is required but not provided');
            }

            // Ensure the URL has a protocol
            const normalizedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;

            // Use the URL API to safely inject the token as the username portion (will produce token@host)
            const parsed = new URL(normalizedUrl);
            // Encode the token to avoid breaking the URL if it contains special chars
            parsed.username = encodeURIComponent(githubToken);
            const repoUrlWithToken = parsed.toString();

            // Use spawnSync with args to avoid shell parsing/quoting issues (handles spaces in paths)
            const result = spawnSync('git', ['clone', repoUrlWithToken, repoDir], { encoding: 'utf-8' });
            if (result.status !== 0) {
                const errText = result.stderr || result.stdout || 'unknown error';
                throw new Error(`git clone failed: ${errText}`);
            }

            return repoDir;
        } catch (err: any) {
            throw new Error('Failed to clone repository: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    async detectTechStack(repoDir: string): Promise<string> {
        try {
            const packageJson = path.join(repoDir, 'package.json');
            if (!fs.existsSync(packageJson)) return 'Unknown';
            const content = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
            const dependencies = { ...(content.dependencies || {}), ...(content.devDependencies || {}) };
            if (dependencies.react) return dependencies.next ? 'Next.js' : 'React';
            if (dependencies.vue) return 'Vue';
            if (dependencies.angular) return 'Angular';
            if (dependencies.express) return 'Express.js';
            return 'Unknown';
        } catch (err) {
            throw new Error('Failed to detect tech stack');
        }
    }

    async pushDockerfile(repoUrl: string, token: string | undefined, dockerfileContent: string, branchName = `dockgen/add-dockerfile-${Date.now()}`): Promise<{ branch: string }> {
        // Clone repo using token
        const repoDir = await this.cloneRepository(repoUrl, token);
        try {
            // Ensure Dockerfile is written
            fs.writeFileSync(path.join(repoDir, 'Dockerfile'), dockerfileContent);

            // Create and checkout new branch
            let r = spawnSync('git', ['-C', repoDir, 'checkout', '-b', branchName], { encoding: 'utf-8' });
            if (r.status !== 0) {
                // if branch exists, checkout
                // try checkout without -b
                r = spawnSync('git', ['-C', repoDir, 'checkout', branchName], { encoding: 'utf-8' });
                if (r.status !== 0) {
                    throw new Error(`Failed to create or checkout branch: ${r.stderr || r.stdout}`);
                }
            }

            // Stage and commit
            r = spawnSync('git', ['-C', repoDir, 'add', 'Dockerfile'], { encoding: 'utf-8' });
            if (r.status !== 0) throw new Error(`git add failed: ${r.stderr || r.stdout}`);

            r = spawnSync('git', ['-C', repoDir, 'commit', '-m', 'Add Dockerfile generated by DockGen AI'], { encoding: 'utf-8' });
            // If commit returns non-zero but stderr contains 'nothing to commit', it's fine
            if (r.status !== 0 && !/nothing to commit/i.test(r.stderr || '')) throw new Error(`git commit failed: ${r.stderr || r.stdout}`);

            // Ensure remote URL contains token — set remote URL to include token to allow push
            const normalizedUrl = repoUrl.startsWith('http://') || repoUrl.startsWith('https://') ? repoUrl : `https://${repoUrl}`;
            const parsed = new URL(normalizedUrl);
            parsed.username = encodeURIComponent(token || process.env.GITHUB_PAT || '');
            const repoUrlWithToken = parsed.toString();
            r = spawnSync('git', ['-C', repoDir, 'remote', 'set-url', 'origin', repoUrlWithToken], { encoding: 'utf-8' });
            if (r.status !== 0) throw new Error(`git remote set-url failed: ${r.stderr || r.stdout}`);

            // Push branch
            r = spawnSync('git', ['-C', repoDir, 'push', '-u', 'origin', branchName], { encoding: 'utf-8' });
            if (r.status !== 0) throw new Error(`git push failed: ${r.stderr || r.stdout}`);

            return { branch: branchName };
        } finally {
            this.cleanup(repoDir);
        }
    }

    cleanup(repoDir: string): void {
        try {
            fs.rmSync(repoDir, { recursive: true, force: true });
        } catch (err) {
            console.error('Failed to cleanup:', err);
        }
    }

    private validateNextJsProject(repoDir: string): void {
        const pkgPath = path.join(repoDir, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            throw new Error('package.json not found');
        }

        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        
        // Check for Next.js dependency
        const hasNextJs = pkg.dependencies?.next || pkg.devDependencies?.next;
        if (!hasNextJs) {
            throw new Error('Next.js dependency not found in package.json');
        }

        // Check build script exists
        if (!pkg.scripts?.build) {
            throw new Error('No build script found in package.json');
        }

        // Ensure next.config.js doesn't force standalone mode
        const configPath = path.join(repoDir, 'next.config.js');
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');
            if (configContent.includes('output: "standalone"') || 
                configContent.includes("output: 'standalone'")) {
                throw new Error('Standalone output mode is not supported in this configuration');
            }
        }
    }
}