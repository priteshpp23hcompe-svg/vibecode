import { TemplateFile, TemplateFolder } from "../types";

export function findFolderByPath(root: TemplateFolder, path: string): TemplateFolder | null {
    if (!path || path === "." || path === "/") return root;

    const parts = path.split("/").filter(Boolean);
    let current: TemplateFolder = root;

    for (const part of parts) {
        const next = current.items.find(
            (item) => "folderName" in item && item.folderName === part
        ) as TemplateFolder;

        if (!next) return null;
        current = next;
    }

    return current;
}

export function deleteFileFromTree(
    root: TemplateFolder,
    filename: string,
    fileExtension: string,
    parentPath: string
): boolean {
    const folder = findFolderByPath(root, parentPath);
    if (!folder) return false;

    const initialLength = folder.items.length;
    folder.items = folder.items.filter(
        (item) =>
            !("filename" in item) ||
            item.filename !== filename ||
            item.fileExtension !== fileExtension
    );

    return folder.items.length < initialLength;
}

export function deleteFolderFromTree(
    root: TemplateFolder,
    folderName: string,
    parentPath: string
): boolean {
    const folder = findFolderByPath(root, parentPath);
    if (!folder) return false;

    const initialLength = folder.items.length;
    folder.items = folder.items.filter(
        (item) => !("folderName" in item) || item.folderName !== folderName
    );

    return folder.items.length < initialLength;
}

export function renameFileInTree(
    root: TemplateFolder,
    oldFilename: string,
    oldExtension: string,
    newFilename: string,
    newExtension: string,
    parentPath: string
): boolean {
    const folder = findFolderByPath(root, parentPath);
    if (!folder) return false;

    const file = folder.items.find(
        (item) =>
            "filename" in item &&
            item.filename === oldFilename &&
            item.fileExtension === oldExtension
    ) as TemplateFile;

    if (!file) return false;

    file.filename = newFilename;
    file.fileExtension = newExtension;
    return true;
}

export function renameFolderInTree(
    root: TemplateFolder,
    oldFolderName: string,
    newFolderName: string,
    parentPath: string
): boolean {
    const folder = findFolderByPath(root, parentPath);
    if (!folder) return false;

    const target = folder.items.find(
        (item) => "folderName" in item && item.folderName === oldFolderName
    ) as TemplateFolder;

    if (!target) return false;

    target.folderName = newFolderName;
    return true;
}
