import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class Markdownify {
    static async _markitdown(filePath, projectRoot, uvPath) {
        const venvPath = path.join(projectRoot, ".venv");
        const markitdownPath = path.join(venvPath, process.platform === 'win32' ? 'Scripts' : 'bin', `markitdown${process.platform === 'win32' ? '.exe' : ''}`);
        if (!fs.existsSync(markitdownPath)) {
            throw new Error("markitdown executable not found");
        }
        const { stdout, stderr } = await execAsync(`${uvPath} run ${markitdownPath} "${filePath}"`);
        if (stderr) {
            throw new Error(`Error executing command: ${stderr}`);
        }
        return stdout;
    }
    static async saveToTempFile(content, suggestedExtension) {
        let outputExtension = "md";
        if (suggestedExtension != null) {
            outputExtension = suggestedExtension;
        }
        const tempOutputPath = path.join(os.tmpdir(), `markdown_output_${Date.now()}.${outputExtension}`);
        fs.writeFileSync(tempOutputPath, content);
        return tempOutputPath;
    }
    static normalizePath(p) {
        return path.normalize(p);
    }
    static expandHome(filepath) {
        if (filepath.startsWith('~/') || filepath === '~') {
            return path.join(os.homedir(), filepath.slice(1));
        }
        return filepath;
    }
    static async toMarkdown({ filePath, url, projectRoot = path.resolve(__dirname, ".."), uvPath = "~/.local/bin/uv", }) {
        try {
            let inputPath;
            let isTemporary = false;
            if (url) {
                const response = await fetch(url);
                let extension = null;
                if (url.endsWith(".pdf")) {
                    extension = "pdf";
                }
                const arrayBuffer = await response.arrayBuffer();
                const content = Buffer.from(arrayBuffer);
                inputPath = await this.saveToTempFile(content, extension);
                isTemporary = true;
            }
            else if (filePath) {
                inputPath = filePath;
            }
            else {
                throw new Error("Either filePath or url must be provided");
            }
            const text = await this._markitdown(inputPath, projectRoot, uvPath);
            const outputPath = await this.saveToTempFile(text);
            if (isTemporary) {
                fs.unlinkSync(inputPath);
            }
            return { path: outputPath, text };
        }
        catch (e) {
            if (e instanceof Error) {
                throw new Error(`Error processing to Markdown: ${e.message}`);
            }
            else {
                throw new Error("Error processing to Markdown: Unknown error occurred");
            }
        }
    }
    static async get({ filePath, }) {
        // Check file type is *.md or *.markdown
        const normPath = this.normalizePath(path.resolve(this.expandHome(filePath)));
        const markdownExt = [".md", ".markdown"];
        if (!markdownExt.includes(path.extname(normPath))) {
            throw new Error("Required file is not a Markdown file.");
        }
        if (process.env?.MD_SHARE_DIR) {
            const allowedShareDir = this.normalizePath(path.resolve(this.expandHome(process.env.MD_SHARE_DIR)));
            if (!normPath.startsWith(allowedShareDir)) {
                throw new Error(`Only files in ${allowedShareDir} are allowed.`);
            }
        }
        if (!fs.existsSync(filePath)) {
            throw new Error("File does not exist");
        }
        const text = await fs.promises.readFile(filePath, "utf-8");
        return {
            path: filePath,
            text: text,
        };
    }
}
