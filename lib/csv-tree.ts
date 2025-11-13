import fs from 'fs';
import path from 'path';

export type CsvFile = {
  kind: 'file';
  name: string;
  path: string[];
};

export type CsvFolder = {
  kind: 'folder';
  name: string;
  path: string[];
  entries: CsvEntry[];
};

export type CsvEntry = CsvFile | CsvFolder;

export type CsvToc = {
  folders: CsvFolder[];
  rootFiles: CsvFile[];
};

function safeReadDir(dir: string): fs.Dirent[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(entry => !entry.name.startsWith('.'));
  } catch {
    return [];
  }
}

function sortByLocale<T extends { name: string }>(items: T[]): T[] {
  items.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return items;
}

function buildFolderEntries(absDir: string, segments: string[]): CsvEntry[] {
  const dirents = safeReadDir(absDir);
  sortByLocale(dirents);

  const entries: CsvEntry[] = [];
  for (const entry of dirents) {
    if (entry.isDirectory()) {
      const folderSegments = [...segments, entry.name];
      entries.push(buildFolder(path.join(absDir, entry.name), folderSegments));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      entries.push({
        kind: 'file',
        name: entry.name.replace(/\.csv$/i, ''),
        path: [...segments, entry.name],
      });
    }
  }

  return entries;
}

function buildFolder(absDir: string, segments: string[]): CsvFolder {
  return {
    kind: 'folder',
    name: segments[segments.length - 1] ?? '',
    path: segments,
    entries: buildFolderEntries(absDir, segments),
  };
}

export function buildCsvToc(rootDir: string): CsvToc {
  const dirents = safeReadDir(rootDir);
  sortByLocale(dirents);

  const folders: CsvFolder[] = [];
  const rootFiles: CsvFile[] = [];

  for (const entry of dirents) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      folders.push(buildFolder(entryPath, [entry.name]));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      rootFiles.push({
        kind: 'file',
        name: entry.name.replace(/\.csv$/i, ''),
        path: [entry.name],
      });
    }
  }

  sortByLocale(rootFiles);
  return { folders, rootFiles };
}

function collectCsvSegments(dir: string, parents: string[]): string[][] {
  const dirents = safeReadDir(dir);
  sortByLocale(dirents);

  const results: string[][] = [];
  for (const entry of dirents) {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectCsvSegments(nextPath, [...parents, entry.name]));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
      results.push([...parents, entry.name]);
    }
  }

  return results;
}

export function collectCsvFiles(rootDir: string): string[][] {
  return collectCsvSegments(rootDir, []);
}
