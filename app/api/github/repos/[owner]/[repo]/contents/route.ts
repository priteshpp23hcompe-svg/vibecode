import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

interface GitHubTreeItem {
    path: string;
    mode: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
    url: string;
}

interface TemplateFile {
    filename: string;
    fileExtension: string;
    content: string;
}

interface TemplateFolder {
    folderName: string;
    items: (TemplateFile | TemplateFolder)[];
}

const MAX_FILE_SIZE = 100 * 1024; // 100KB limit per file
const MAX_FILES = 200; // Limit total files to fetch

// Binary file extensions to skip
const BINARY_EXTENSIONS = new Set([
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp",
    "mp3", "mp4", "avi", "mov", "wav", "ogg",
    "zip", "tar", "gz", "rar", "7z",
    "pdf", "doc", "docx", "xls", "xlsx",
    "exe", "dll", "so", "dylib",
    "woff", "woff2", "ttf", "eot", "otf",
    "lock",
]);

// Folders to ignore
const IGNORED_FOLDERS = new Set([
    "node_modules", ".git", ".next", "dist", "build", ".cache",
    "__pycache__", ".venv", "vendor", ".idea", ".vscode",
]);

function shouldIgnorePath(filePath: string): boolean {
    const parts = filePath.split("/");
    return parts.some((part) => IGNORED_FOLDERS.has(part));
}

function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0) return "";
    return filename.substring(lastDot + 1);
}

function getFileName(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0) return filename;
    return filename.substring(0, lastDot);
}

function buildTemplateTree(
    files: { path: string; content: string }[]
): TemplateFolder {
    const root: TemplateFolder = { folderName: "Root", items: [] };

    for (const file of files) {
        const parts = file.path.split("/");
        let current = root;

        // Navigate/create folders
        for (let i = 0; i < parts.length - 1; i++) {
            const folderName = parts[i];
            let existingFolder = current.items.find(
                (item): item is TemplateFolder =>
                    "folderName" in item && item.folderName === folderName
            );

            if (!existingFolder) {
                existingFolder = { folderName, items: [] };
                current.items.push(existingFolder);
            }
            current = existingFolder;
        }

        // Add the file
        const fileName = parts[parts.length - 1];
        const ext = getFileExtension(fileName);
        const name = getFileName(fileName);

        current.items.push({
            filename: name,
            fileExtension: ext,
            content: file.content,
        });
    }

    // Sort items: folders first, then files, alphabetically within each group
    sortFolder(root);

    return root;
}

function sortFolder(folder: TemplateFolder) {
    folder.items.sort((a, b) => {
        const aIsFolder = "folderName" in a;
        const bIsFolder = "folderName" in b;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        const aName = "folderName" in a ? a.folderName : a.filename;
        const bName = "folderName" in b ? b.folderName : b.filename;
        return aName.localeCompare(bName);
    });

    for (const item of folder.items) {
        if ("folderName" in item) {
            sortFolder(item);
        }
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ owner: string; repo: string }> }
) {
    try {
        const { owner, repo } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const account = await db.account.findFirst({
            where: {
                userId: session.user.id,
                provider: "github",
            },
            select: {
                accessToken: true,
            },
        });

        if (!account?.accessToken) {
            return NextResponse.json(
                { error: "GitHub account not linked" },
                { status: 403 }
            );
        }

        const token = account.accessToken;
        const headers = {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
        };

        // Get the default branch
        const repoRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            { headers }
        );

        if (!repoRes.ok) {
            return NextResponse.json(
                { error: `Failed to fetch repository info: ${repoRes.status}` },
                { status: repoRes.status }
            );
        }

        const repoData = await repoRes.json();
        const branch = repoData.default_branch || "main";

        // Get the full tree recursively
        const treeRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
            { headers }
        );

        if (!treeRes.ok) {
            return NextResponse.json(
                { error: `Failed to fetch repository tree: ${treeRes.status}` },
                { status: treeRes.status }
            );
        }

        const treeData = await treeRes.json();

        if (treeData.truncated) {
            console.warn("Repository tree was truncated due to large size");
        }

        // Filter to only blobs (files) that are not too large, not binary, and not in ignored folders
        const filesToFetch: GitHubTreeItem[] = (treeData.tree as GitHubTreeItem[])
            .filter((item) => {
                if (item.type !== "blob") return false;
                if (item.size && item.size > MAX_FILE_SIZE) return false;
                if (shouldIgnorePath(item.path)) return false;
                const ext = getFileExtension(item.path.split("/").pop() || "");
                if (BINARY_EXTENSIONS.has(ext.toLowerCase())) return false;
                return true;
            })
            .slice(0, MAX_FILES);

        // Fetch file contents in parallel (batched)
        const BATCH_SIZE = 20;
        const fileContents: { path: string; content: string }[] = [];

        for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
            const batch = filesToFetch.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(async (file) => {
                    const blobRes = await fetch(
                        `https://api.github.com/repos/${owner}/${repo}/git/blobs/${file.sha}`,
                        { headers }
                    );

                    if (!blobRes.ok) {
                        throw new Error(`Failed to fetch ${file.path}`);
                    }

                    const blobData = await blobRes.json();

                    let content = "";
                    if (blobData.encoding === "base64") {
                        content = Buffer.from(blobData.content, "base64").toString("utf-8");
                    } else {
                        content = blobData.content || "";
                    }

                    return { path: file.path, content };
                })
            );

            for (const result of results) {
                if (result.status === "fulfilled") {
                    fileContents.push(result.value);
                }
            }
        }

        // Build the TemplateFolder tree
        const templateData = buildTemplateTree(fileContents);

        return NextResponse.json({
            templateData,
            repoName: repoData.name,
            repoDescription: repoData.description,
            totalFiles: fileContents.length,
        });
    } catch (error) {
        console.error("Error fetching repo contents:", error);
        return NextResponse.json(
            { error: "Failed to fetch repository contents" },
            { status: 500 }
        );
    }
}
