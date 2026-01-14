import JSZip from 'jszip';
import { 
  WhiteboardData, 
  ChatMessage, 
  PlaygroundCode, 
  AppTheme, 
  GeminiModel,
  ExportedSessionManifest,
  SyllabusData 
} from '../types';

const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};

const addSessionToZip = (
  zipFolder: JSZip, 
  whiteboards: WhiteboardData[], 
  chatHistory: ChatMessage[], 
  playgrounds: PlaygroundCode[],
  theme: AppTheme,
  model: GeminiModel,
  syllabus?: SyllabusData | null,
  syllabusGallery?: SyllabusData[]
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
      filePath: `whiteboards/${fileName}`,
      audioSensitivity: wb.audioSensitivity 
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
    version: "1.3", // Updated for Syllabus support
    createdAt: Date.now(),
    theme,
    model,
    chatHistory,
    whiteboards: manifestWhiteboards,
    playgrounds: manifestPlaygrounds,
    // New Fields
    syllabus: syllabus,
    syllabusGallery: syllabusGallery || []
  };

  zipFolder.file("session_manifest.json", JSON.stringify(manifest, null, 2));
};

export const exportSessionToZip = async (
  whiteboards: WhiteboardData[],
  chatHistory: ChatMessage[],
  playgrounds: PlaygroundCode[],
  theme: AppTheme,
  model: GeminiModel,
  syllabus?: SyllabusData | null,
  syllabusGallery?: SyllabusData[]
): Promise<Blob> => {
  const zip = new JSZip();
  addSessionToZip(zip, whiteboards, chatHistory, playgrounds, theme, model, syllabus, syllabusGallery);
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
    model: GeminiModel,
    syllabus?: SyllabusData | null,
    syllabusGallery?: SyllabusData[]
  }>
): Promise<Blob> => {
  const zip = new JSZip();

  sessions.forEach(session => {
    const path = session.group ? `${sanitizeFilename(session.group)}/${sanitizeFilename(session.name)}` : sanitizeFilename(session.name);
    const folder = zip.folder(path);
    if (folder) {
      addSessionToZip(folder, session.whiteboards, session.chatHistory, session.playgrounds, session.theme, session.model, session.syllabus, session.syllabusGallery);
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
  syllabus?: SyllabusData | null;
  syllabusGallery?: SyllabusData[];
  name?: string;
  group?: string;
}

const extractSessionFromFolder = async (zip: JSZip, rootPath: string): Promise<ImportedSessionResult> => {
  const manifestFile = zip.file(rootPath + "session_manifest.json");
  if (!manifestFile) throw new Error(`Manifest not found in ${rootPath}`);

  const manifest = JSON.parse(await manifestFile.async("string")) as ExportedSessionManifest;

  const whiteboards = await Promise.all(
    manifest.whiteboards.map(async (wbItem) => {
      const fullPath = rootPath + wbItem.filePath;
      const svgFile = zip.file(fullPath);
      return {
        id: wbItem.id,
        topic: wbItem.topic,
        explanation: wbItem.explanation,
        timestamp: wbItem.timestamp,
        svgContent: svgFile ? await svgFile.async("string") : "",
        audioSensitivity: wbItem.audioSensitivity || false
      };
    })
  );

  let playgrounds: PlaygroundCode[] = [];
  
  // Standard Modern Import (Array)
  if (manifest.playgrounds) {
    playgrounds = await Promise.all(
        manifest.playgrounds.map(async (pgItem) => {
            const fullPath = rootPath + pgItem.filePath;
            const htmlFile = zip.file(fullPath);
            
            // Heuristic for Type if not explicitly saved in older versions
            const isTest = pgItem.description.toLowerCase().includes('level test') || 
                           pgItem.description.toLowerCase().startsWith('test:') ||
                           pgItem.description.toLowerCase().includes('exam');
            
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
  } 
  // Legacy Import (Single Object) - RESTORED
  else if ((manifest as any).playground) {
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
    model: manifest.model,
    syllabus: manifest.syllabus || null,
    syllabusGallery: manifest.syllabusGallery || []
  };
};

export const importLibraryFromZip = async (file: File): Promise<ImportedSessionResult[]> => {
  const zip = await JSZip.loadAsync(file);
  const results: ImportedSessionResult[] = [];
  
  const manifestPaths: string[] = [];
  zip.forEach((relativePath) => {
    if (relativePath.endsWith('session_manifest.json')) {
      manifestPaths.push(relativePath);
    }
  });

  if (manifestPaths.length === 0) throw new Error("No valid session manifests found in ZIP.");

  for (const path of manifestPaths) {
    const rootPath = path.replace('session_manifest.json', '');
    try {
      const session = await extractSessionFromFolder(zip, rootPath);
      
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
