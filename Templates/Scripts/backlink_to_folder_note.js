/**
 * Templater User Script: backlink_to_folder_note
 *
 * For every note inside a folder, adds a link to that folder's folder note
 * (assumes the "Folder Notes" plugin convention: a folder named "ME" has a
 * folder note at "ME/ME.md"). Skips notes that are already linked.
 *
 * Folder notes themselves are also eligible: a folder note (e.g. "ME/ME.md")
 * will get linked to ITS PARENT folder's folder note, if one exists — so
 * folder notes can chain up into other folder notes, building a hierarchy
 * in the graph. A folder note is never linked to itself.
 *
 * The link is added as a frontmatter property, e.g.:
 *   related:
 *     - "[[ME]]"
 *
 * This shows up in graph view as an edge, just like an inline wikilink would.
 *
 * SETUP:
 * 1. Put this file in your Templater "User Scripts Folder"
 *    (Settings → Templater → Script Files).
 * 2. Create a throwaway note and paste in:
 *
 *      <%* await tp.user.backlink_to_folder_note(tp, "ME") %>
 *
 *    ...to process notes DIRECTLY inside "ME" only (not subfolders).
 *
 *      <%* await tp.user.backlink_to_folder_note(tp, "School", true) %>
 *
 *    ...to process "School" AND every subfolder beneath it, recursively.
 *
 * 3. Run "Templater: Replace templater syntax in the active file" (or
 *    "Insert Template" if you have a template folder configured) on that
 *    note. Check the console (Ctrl+Shift+I) and the Notice popup for a
 *    summary.
 * 4. Delete the throwaway note. This is a one-time bulk operation.
 *
 * USAGE:
 *   tp.user.backlink_to_folder_note(tp, scopeFolder, recursive, propertyName, nearestAncestor)
 *
 *   scopeFolder      - folder to process, e.g. "School/Year 3", or "/" for vault root.
 *   recursive        - process scopeFolder AND every subfolder beneath it,
 *                       not just direct children. Default: false. Each note
 *                       still links to its OWN immediate parent folder's
 *                       note, regardless of depth.
 *   propertyName     - frontmatter property to store the link in. Default: "related".
 *   nearestAncestor  - if a folder has no folder note of its own, walk UP to
 *                       the nearest ancestor that has one. Default: false
 *                       (exact match only — a folder with no folder note is
 *                       simply skipped, not bridged past).
 *
 * EXAMPLES:
 *   <%* await tp.user.backlink_to_folder_note(tp, "ME") %>
 *   <%* await tp.user.backlink_to_folder_note(tp, "School", true) %>
 *   <%* await tp.user.backlink_to_folder_note(tp, "ME", false, "links", true) %>
 *
 * NOTES / ASSUMPTIONS:
 * - Folder note path convention: "<folder>/<folder-name>.md" (the default
 *   for the Folder Notes plugin, "store inside the folder"). If you use a
 *   different convention, tell me and I'll adjust.
 * - A folder with no folder note of its own is simply skipped unless
 *   nearestAncestor is true.
 */

async function backlink_to_folder_note(tp, scopeFolder, recursive = false, propertyName = "related", nearestAncestor = false) {
    const app = tp.app;
    const vault = app.vault;

    const normalizedScope = scopeFolder === "/" ? "" : scopeFolder.replace(/\/$/, "");

    // Build a quick lookup: folder path -> folder note TFile (if it exists)
    const allFiles = vault.getMarkdownFiles();
    const folderNoteByFolder = new Map();
    for (const file of allFiles) {
        const folderPath = file.parent ? file.parent.path : "";
        const folderName = file.parent ? file.parent.name : "";
        if (file.basename === folderName) {
            folderNoteByFolder.set(folderPath, file);
        }
    }

    function findFolderNoteFor(folderPath) {
        let path = folderPath;
        while (true) {
            if (folderNoteByFolder.has(path)) {
                return folderNoteByFolder.get(path);
            }
            if (!nearestAncestor || path === "") {
                return null;
            }
            const lastSlash = path.lastIndexOf("/");
            path = lastSlash === -1 ? "" : path.substring(0, lastSlash);
        }
    }

    let targetFiles;
    if (recursive) {
        // Every file at or beneath scopeFolder, any depth.
        targetFiles = allFiles.filter(f => {
            if (normalizedScope === "") return true;
            return f.path === `${normalizedScope}/${f.name}` || f.path.startsWith(`${normalizedScope}/`);
        });
    } else {
        // Non-recursive: only files that "live directly within" the
        // requested scope folder. For a regular note that means its direct
        // parent folder matches scope. For a FOLDER NOTE, the note itself
        // physically sits one level deeper than the folder it represents
        // (e.g. "Testttttt/Testttttt.md") — so for folder notes we check
        // that THEIR FOLDER is a direct child of scope, not the note file.
        targetFiles = allFiles.filter(f => {
            const parentPath = f.parent ? f.parent.path : "";
            const isFolderNote = f.parent && f.basename === f.parent.name;
            if (isFolderNote) {
                const grandparentPath = f.parent.parent ? f.parent.parent.path : "";
                return grandparentPath === normalizedScope;
            }
            return parentPath === normalizedScope;
        });
    }

    let linked = 0;
    let skippedAlready = 0;
    let skippedNoFolderNote = 0;
    let skippedIsFolderNote = 0;

    for (const file of targetFiles) {
        const parentFolder = file.parent;
        const isFolderNote = parentFolder && file.basename === parentFolder.name;

        // For a regular note, look up its own folder's folder note.
        // For a folder note, look up ITS PARENT folder's folder note,
        // so folder notes can chain up into a parent folder note.
        let lookupPath;
        if (isFolderNote) {
            lookupPath = parentFolder.parent ? parentFolder.parent.path : null;
        } else {
            lookupPath = parentFolder ? parentFolder.path : "";
        }

        if (lookupPath === null) {
            // Folder note at vault root has no parent folder to link to.
            skippedNoFolderNote++;
            continue;
        }

        const folderNote = findFolderNoteFor(lookupPath);

        if (!folderNote) {
            skippedNoFolderNote++;
            continue;
        }
        if (file.path === folderNote.path) {
            // Safety net: never link a note to itself.
            skippedIsFolderNote++;
            continue;
        }

        const linkTarget = app.metadataCache.fileToLinktext(folderNote, file.path);
        const linkValue = `[[${linkTarget}]]`;

        // Normalize a stored value for comparison: strip brackets, quotes,
        // whitespace, any |alias suffix, then lowercase. This makes the
        // match resilient to minor formatting differences Obsidian/Properties
        // may introduce between runs.
        function normalize(v) {
            if (typeof v !== "string") return null;
            return v
                .replace(/^["']|["']$/g, "")
                .replace(/[\[\]]/g, "")
                .split("|")[0]
                .trim()
                .toLowerCase();
        }

        const normalizedTarget = normalize(linkValue);

        let didLink = false;
        await app.fileManager.processFrontMatter(file, (fm) => {
            const existing = fm[propertyName];
            if (!existing) {
                fm[propertyName] = [linkValue];
                didLink = true;
            } else if (Array.isArray(existing)) {
                const alreadyLinked = existing.some(v => normalize(v) === normalizedTarget);
                if (!alreadyLinked) {
                    existing.push(linkValue);
                    didLink = true;
                }
            } else if (typeof existing === "string") {
                if (normalize(existing) !== normalizedTarget) {
                    fm[propertyName] = [existing, linkValue];
                    didLink = true;
                }
            }
        });

        if (didLink) {
            linked++;
        } else {
            skippedAlready++;
        }
    }

    const summary = `Linked ${linked} note(s) to their folder note. ` +
        `Skipped: ${skippedAlready} already linked, ${skippedNoFolderNote} no folder note found, ${skippedIsFolderNote} self-link prevented.`;

    console.log(`backlink_to_folder_note: ${summary}`);
    new Notice(summary, 8000);
}

module.exports = backlink_to_folder_note;
