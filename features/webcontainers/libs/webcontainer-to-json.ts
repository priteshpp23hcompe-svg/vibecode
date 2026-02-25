import { WebContainer } from "@webcontainer/api";
import { TemplateFile, TemplateFolder } from "../../playground/types";

/**
 * Scans a WebContainer directory and returns a structured JSON representation
 */
export async function scanWebContainerDirectory(
    instance: WebContainer,
    path: string = ".",
    folderName: string = "root"
): Promise<TemplateFolder> {
    const entries = await instance.fs.readdir(path, { withFileTypes: true });
    const items: (TemplateFile | TemplateFolder)[] = [];

    for (const entry of entries) {
        const entryPath = path === "." ? entry.name : `${path}/${entry.name}`;

        // Skip node_modules and .git for performance and common sense
        if (entry.name === "node_modules" || entry.name === ".git") continue;

        if (entry.isDirectory()) {
            const subFolder = await scanWebContainerDirectory(instance, entryPath, entry.name);
            items.push(subFolder);
        } else {
            const content = await instance.fs.readFile(entryPath, "utf8");
            const lastDotIndex = entry.name.lastIndexOf(".");
            const filename = lastDotIndex !== -1 ? entry.name.slice(0, lastDotIndex) : entry.name;
            const fileExtension = lastDotIndex !== -1 ? entry.name.slice(lastDotIndex + 1) : "";

            items.push({
                filename,
                fileExtension,
                content,
            });
        }
    }

    return {
        folderName,
        items,
    };
}
