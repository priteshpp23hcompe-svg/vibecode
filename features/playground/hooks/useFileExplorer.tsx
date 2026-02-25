import { create } from "zustand";
import { toast } from "sonner";
import { WebContainer } from "@webcontainer/api";
import { TemplateFile, TemplateFolder } from "../types";
import { generateFileId } from "../libs";
import {
  findFolderByPath,
  deleteFileFromTree,
  deleteFolderFromTree,
  renameFileInTree,
  renameFolderInTree
} from "../libs/tree-utils";

interface OpenFile extends TemplateFile {
  id: string;
  hasUnsavedChanges: boolean;
  content: string;
  originalContent: string;
}

interface FileExplorerState {
  playgroundId: string;
  templateData: TemplateFolder | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
  editorContent: string;

  // Actions
  setPlaygroundId: (id: string) => void;
  setTemplateData: (data: TemplateFolder | null) => void;
  setEditorContent: (content: string) => void;
  setOpenFiles: (files: OpenFile[]) => void;
  setActiveFileId: (fileId: string | null) => void;
  openFile: (file: TemplateFile) => void;
  closeFile: (fileId: string) => void;
  closeAllFiles: () => void;
  handleAddFile: (
    newFile: TemplateFile,
    parentPath: string,
    writeFileSync: (filePath: string, content: string) => Promise<void>,
    instance: WebContainer | null,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  handleAddFolder: (
    newFolder: TemplateFolder,
    parentPath: string,
    instance: WebContainer | null,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  handleDeleteFile: (
    file: TemplateFile,
    parentPath: string,
    instance: WebContainer | null,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  handleDeleteFolder: (
    folder: TemplateFolder,
    parentPath: string,
    instance: WebContainer | null,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  handleRenameFile: (
    file: TemplateFile,
    newFilename: string,
    newExtension: string,
    parentPath: string,
    instance: WebContainer | null,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  handleRenameFolder: (
    folder: TemplateFolder,
    newFolderName: string,
    parentPath: string,
    instance: WebContainer | null,
    saveTemplateData: (data: TemplateFolder) => Promise<void>
  ) => Promise<void>;
  syncFromFS: (instance: WebContainer | null) => Promise<void>;
  updateFileContent: (fileId: string, content: string) => void;
}

export const useFileExplorer = create<FileExplorerState>((set, get) => ({
  templateData: null,
  playgroundId: "",
  openFiles: [],
  activeFileId: null,
  editorContent: "",

  setPlaygroundId: (id) => set({ playgroundId: id }),
  setTemplateData: (data) => set({ templateData: data }),
  setEditorContent: (content) => set({ editorContent: content }),
  setOpenFiles: (files) => set({ openFiles: files }),
  setActiveFileId: (fileId) => set({ activeFileId: fileId }),

  syncFromFS: async (instance) => {
    if (!instance || !instance.fs) return;
    try {
      const { scanWebContainerDirectory } = await import("../../webcontainers/libs/webcontainer-to-json");
      const newTemplateData = await scanWebContainerDirectory(instance);
      set({ templateData: newTemplateData });
    } catch (error) {
      console.error("Failed to sync from FS:", error);
    }
  },

  openFile: (file) => {
    const { templateData, openFiles } = get();
    if (!templateData) return;

    const fileId = generateFileId(file, templateData);
    const existingFile = openFiles.find((f) => f.id === fileId);

    if (existingFile) {
      set({ activeFileId: fileId, editorContent: existingFile.content });
      return;
    }

    const newOpenFile: OpenFile = {
      ...file,
      id: fileId,
      hasUnsavedChanges: false,
      content: file.content || "",
      originalContent: file.content || "",
    };

    set((state) => ({
      openFiles: [...state.openFiles, newOpenFile],
      activeFileId: fileId,
      editorContent: file.content || "",
    }));
  },

  closeFile: (fileId) => {
    const { openFiles, activeFileId } = get();
    const newFiles = openFiles.filter((f) => f.id !== fileId);

    let newActiveFileId = activeFileId;
    let newEditorContent = get().editorContent;

    if (activeFileId === fileId) {
      if (newFiles.length > 0) {
        const lastFile = newFiles[newFiles.length - 1];
        newActiveFileId = lastFile.id;
        newEditorContent = lastFile.content;
      } else {
        newActiveFileId = null;
        newEditorContent = "";
      }
    }

    set({
      openFiles: newFiles,
      activeFileId: newActiveFileId,
      editorContent: newEditorContent,
    });
  },

  closeAllFiles: () => {
    set({
      openFiles: [],
      activeFileId: null,
      editorContent: "",
    });
  },

  handleAddFile: async (newFile, parentPath, writeFileSync, instance, saveTemplateData) => {
    const { templateData } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
      const folder = findFolderByPath(updatedTemplateData, parentPath);

      if (folder) {
        folder.items.push(newFile);
        set({ templateData: updatedTemplateData });
        await saveTemplateData(updatedTemplateData);

        if (instance?.fs) {
          const filePath = parentPath ? `${parentPath}/${newFile.filename}.${newFile.fileExtension}` : `${newFile.filename}.${newFile.fileExtension}`;
          await writeFileSync(filePath, newFile.content || "");
        }

        get().openFile(newFile);
        toast.success(`Created file: ${newFile.filename}.${newFile.fileExtension}`);
      }
    } catch (error) {
      console.error("Error adding file:", error);
      toast.error("Failed to create file");
    }
  },

  handleAddFolder: async (newFolder, parentPath, instance, saveTemplateData) => {
    const { templateData } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
      const folder = findFolderByPath(updatedTemplateData, parentPath);

      if (folder) {
        folder.items.push(newFolder);
        set({ templateData: updatedTemplateData });
        await saveTemplateData(updatedTemplateData);

        if (instance?.fs) {
          const folderPath = parentPath ? `${parentPath}/${newFolder.folderName}` : newFolder.folderName;
          await instance.fs.mkdir(folderPath, { recursive: true });
        }

        toast.success(`Created folder: ${newFolder.folderName}`);
      }
    } catch (error) {
      console.error("Error adding folder:", error);
      toast.error("Failed to create folder");
    }
  },

  handleDeleteFile: async (file, parentPath, instance, saveTemplateData) => {
    const { templateData, openFiles } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
      if (deleteFileFromTree(updatedTemplateData, file.filename, file.fileExtension, parentPath)) {
        const fileId = `${parentPath}/${file.filename}.${file.fileExtension}`;

        set({
          templateData: updatedTemplateData,
          openFiles: openFiles.filter((f) => f.id !== fileId),
        });

        await saveTemplateData(updatedTemplateData);

        if (instance?.fs) {
          const filePath = parentPath ? `${parentPath}/${file.filename}.${file.fileExtension}` : `${file.filename}.${file.fileExtension}`;
          await instance.fs.rm(filePath).catch(() => { });
        }

        toast.success(`Deleted file: ${file.filename}.${file.fileExtension}`);
        if (get().activeFileId === fileId) {
          get().closeFile(fileId);
        }
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
  },

  handleDeleteFolder: async (folder, parentPath, instance, saveTemplateData) => {
    const { templateData } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
      if (deleteFolderFromTree(updatedTemplateData, folder.folderName, parentPath)) {
        set({ templateData: updatedTemplateData });
        await saveTemplateData(updatedTemplateData);

        if (instance?.fs) {
          const folderPath = parentPath ? `${parentPath}/${folder.folderName}` : folder.folderName;
          await instance.fs.rm(folderPath, { recursive: true }).catch(() => { });
        }

        toast.success(`Deleted folder: ${folder.folderName}`);
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast.error("Failed to delete folder");
    }
  },

  handleRenameFile: async (file, newFilename, newExtension, parentPath, instance, saveTemplateData) => {
    const { templateData, openFiles, activeFileId } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
      if (renameFileInTree(updatedTemplateData, file.filename, file.fileExtension, newFilename, newExtension, parentPath)) {
        const oldFileId = `${parentPath}/${file.filename}.${file.fileExtension}`;
        const newFileId = `${parentPath}/${newFilename}.${newExtension}`;

        const updatedOpenFiles = openFiles.map((f) => {
          if (f.id === oldFileId) {
            return { ...f, id: newFileId, filename: newFilename, fileExtension: newExtension };
          }
          return f;
        });

        set({
          templateData: updatedTemplateData,
          openFiles: updatedOpenFiles,
          activeFileId: activeFileId === oldFileId ? newFileId : activeFileId,
        });

        await saveTemplateData(updatedTemplateData);

        if (instance?.fs) {
          const oldPath = parentPath ? `${parentPath}/${file.filename}.${file.fileExtension}` : `${file.filename}.${file.fileExtension}`;
          const newPath = parentPath ? `${parentPath}/${newFilename}.${newExtension}` : `${newFilename}.${newExtension}`;
          await instance.fs.rename(oldPath, newPath).catch(() => { });
        }

        toast.success(`Renamed file to: ${newFilename}.${newExtension}`);
      }
    } catch (error) {
      console.error("Error renaming file:", error);
      toast.error("Failed to rename file");
    }
  },

  handleRenameFolder: async (folder, newFolderName, parentPath, instance, saveTemplateData) => {
    const { templateData } = get();
    if (!templateData) return;

    try {
      const updatedTemplateData = JSON.parse(JSON.stringify(templateData)) as TemplateFolder;
      if (renameFolderInTree(updatedTemplateData, folder.folderName, newFolderName, parentPath)) {
        set({ templateData: updatedTemplateData });
        await saveTemplateData(updatedTemplateData);

        if (instance?.fs) {
          const oldPath = parentPath ? `${parentPath}/${folder.folderName}` : folder.folderName;
          const newPath = parentPath ? `${parentPath}/${newFolderName}` : newFolderName;
          await instance.fs.rename(oldPath, newPath).catch(() => { });
        }

        toast.success(`Renamed folder to: ${newFolderName}`);
      }
    } catch (error) {
      console.error("Error renaming folder:", error);
      toast.error("Failed to rename folder");
    }
  },

  updateFileContent: (fileId, content) => {
    set((state) => ({
      openFiles: state.openFiles.map((file) =>
        file.id === fileId
          ? {
            ...file,
            content,
            hasUnsavedChanges: content !== file.originalContent,
          }
          : file
      ),
      editorContent: fileId === state.activeFileId ? content : state.editorContent,
    }));
  },
}));