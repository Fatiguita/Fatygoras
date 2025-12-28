import JSZip from 'jszip';
import { 
  WhiteboardData, 
  ChatMessage, 
  PlaygroundCode, 
  AppTheme, 
  GeminiModel,
  ExportedSessionManifest 
} from '../types';

const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};

/**
 * Creates a zip file for a SINGLE session.
 * Used internally by exportCollectionToZip or for single session exports.
 */
const addSessionToZip = (
  zipFolder: JSZip, 
  whiteboards: WhiteboardData[], 
  chatHistory: ChatMessage[], 
  playgrounds: PlaygroundCode[],
  theme: AppTheme,
  model: GeminiModel
) => {
  const whiteboardsFolder = zipFolder.folder("whiteboards");
  const playgroundFolder = zipFolder.folder("playgrounds");

  const manifestWhiteboards = whiteboards.map(wb => {
    const fileName = `${sanitizeFilename(wb.topic)}_${wb.id.substring(0, 6)}.svg`;
    whiteboardsFolder?.file(fileName, wb.svgContent);
    return {
      id: wb.id,
      topic: wb.topic,
      explanation: wb.explanation,
      timestamp: wb.timestamp,
      filePath: `whiteboards/${fileName}`
    };
  });

  const manifestPlaygrounds = playgrounds.map(pg => {
    const fileName = `${sanitizeFilename(pg.description)}_${pg.id}.html`;
    playgroundFolder?.file(fileName, pg.html);
    return {
      id: pg.id,
      description: pg.description,
      timestamp: pg.timestamp,
      filePath: `playgrounds/${fileName}`
    };
  });

  const manifest: ExportedSessionManifest = {
    version: "1.1",
    createdAt: Date.now(),
    theme,
    model,
    chatHistory,
    whiteboards: manifestWhiteboards,
    playgrounds: manifestPlaygrounds
  };

  zipFolder.file("session_manifest.json", JSON.stringify(manifest, null, 2));
};

export const exportSessionToZip = async (
  whiteboards: WhiteboardData[],
  chatHistory: ChatMessage[],
  playgrounds: PlaygroundCode[],
  theme: AppTheme,
  model: GeminiModel
): Promise<Blob> => {
  const zip = new JSZip();
  addSessionToZip(zip, whiteboards, chatHistory, playgrounds, theme, model);
  return await zip.generateAsync({ type: "blob" });
};

export const exportCollectionToZip = async (
  sessions: Array<{
    name: string,
    group?: string,
    whiteboards: WhiteboardData[],
    chatHistory: ChatMessage[],
    playgrounds: PlaygroundCode[],
    theme: AppTheme,
    model: GeminiModel
  }>
): Promise<Blob> => {
  const zip = new JSZip();

  sessions.forEach(session => {
    // If it has a group, put it in a subfolder
    const path = session.group ? `${sanitizeFilename(session.group)}/${sanitizeFilename(session.name)}` : sanitizeFilename(session.name);
    const folder = zip.folder(path);
    if (folder) {
      addSessionToZip(folder, session.whiteboards, session.chatHistory, session.playgrounds, session.theme, session.model);
    }
  });

  return await zip.generateAsync({ type: "blob" });
};

interface ImportedSessionResult {
  whiteboards: WhiteboardData[];
  chatHistory: ChatMessage[];
  playgrounds: PlaygroundCode[];
  theme: AppTheme;
  model: GeminiModel;
  name?: string;
  group?: string;
}

/**
 * Helper to extract a single session from a specific root folder in a ZIP.
 */
const extractSessionFromFolder = async (zip: JSZip, rootPath: string): Promise<ImportedSessionResult> => {
  const manifestFile = zip.file(rootPath + "session_manifest.json");
  if (!manifestFile) throw new Error(`Manifest not found in ${rootPath}`);

  const manifest = JSON.parse(await manifestFile.async("string")) as ExportedSessionManifest;

  const whiteboards = await Promise.all(
    manifest.whiteboards.map(async (wbItem) => {
      // Path in manifest is relative (e.g., "whiteboards/a.svg")
      // We need to prepend the rootPath (e.g., "Folder/whiteboards/a.svg")
      const fullPath = rootPath + wbItem.filePath;
      const svgFile = zip.file(fullPath);
      return {
        id: wbItem.id,
        topic: wbItem.topic,
        explanation: wbItem.explanation,
        timestamp: wbItem.timestamp,
        svgContent: svgFile ? await svgFile.async("string") : ""
      };
    })
  );

  let playgrounds: PlaygroundCode[] = [];
  if (manifest.playgrounds) {
    playgrounds = await Promise.all(
        manifest.playgrounds.map(async (pgItem) => {
            const fullPath = rootPath + pgItem.filePath;
            const htmlFile = zip.file(fullPath);
            // Heuristic to determine type since it wasn't saved in older manifests
            // Default to 'practice' unless description suggests otherwise
            const isTest = pgItem.description.toLowerCase().includes('level test') || 
                           pgItem.description.toLowerCase().startsWith('test:');
            
            return {
                id: pgItem.id,
                description: pgItem.description,
                timestamp: pgItem.timestamp || Date.now(),
                html: htmlFile ? await htmlFile.async("string") : "",
                status: 'ready',
                type: isTest ? 'test' : 'practice'
            };
        })
    );
  } else if ((manifest as any).playground) {
     // Legacy support
     const pg = (manifest as any).playground;
     const fullPath = rootPath + pg.filePath;
     const htmlFile = zip.file(fullPath);
     if (htmlFile) {
         playgrounds.push({
             id: 'legacy',
             description: pg.description,
             timestamp: Date.now(),
             html: await htmlFile.async("string"),
             status: 'ready',
             type: 'practice'
         });
     }
  }

  return {
    whiteboards,
    chatHistory: manifest.chatHistory,
    playgrounds,
    theme: manifest.theme,
    model: manifest.model
  };
};

/**
 * Scans a ZIP for ANY session_manifest.json files, allowing for flat or nested structures.
 */
export const importLibraryFromZip = async (file: File): Promise<ImportedSessionResult[]> => {
  const zip = await JSZip.loadAsync(file);
  const results: ImportedSessionResult[] = [];
  
  // Find all manifest files
  const manifestPaths: string[] = [];
  zip.forEach((relativePath) => {
    if (relativePath.endsWith('session_manifest.json')) {
      manifestPaths.push(relativePath);
    }
  });

  if (manifestPaths.length === 0) throw new Error("No valid session manifests found in ZIP.");

  for (const path of manifestPaths) {
    // rootPath is everything up to the manifest file. 
    // e.g., "Folder/Subfolder/session_manifest.json" -> "Folder/Subfolder/"
    // e.g., "session_manifest.json" -> ""
    const rootPath = path.replace('session_manifest.json', '');
    
    try {
      const session = await extractSessionFromFolder(zip, rootPath);
      
      // Determine Group and Name from path
      // rootPath: "Math/Calculus/" -> Group: Math, Name: Calculus
      // rootPath: "Physics/" -> Group: null, Name: Physics
      // rootPath: "" -> Group: null, Name: "Imported Session"
      
      const parts = rootPath.split('/').filter(p => p.length > 0);
      
      if (parts.length === 0) {
        session.name = file.name.replace('.zip', '');
        session.group = undefined;
      } else if (parts.length === 1) {
        session.name = parts[0];
        session.group = undefined;
      } else {
        session.name = parts[parts.length - 1];
        session.group = parts.slice(0, parts.length - 1).join('/');
      }

      results.push(session);
    } catch (err) {
      console.warn(`Failed to import session at ${path}`, err);
    }
  }

  return results;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};