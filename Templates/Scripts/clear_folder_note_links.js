/**
 * Templater User Script: clear_folder_note_links
 *
 * Removes the frontmatter property created by backlink_to_folder_note
 * (default property name: "related") from notes, so you can fully undo
 * the bulk backlinking and start over.
 *
 * SETUP: same as backlink_to_folder_note — put this file in your Templater
 * "User Scripts Folder" alongside it.
 *
 * USAGE:
 *   tp.user.clear_folder_note_links(tp, scopeFolder, recursive, propertyName)
 *
 *   scopeFolder  - folder to clear, e.g. "School/Year 3", or "/" for vault root.
 *   recursive    - clear scopeFolder AND every subfolder beneath it.
 *                  Default: false (matches backlink_to_folder_note's own
 *                  non-recursive scope, so "clear" always undoes exactly
 *                  what a matching "backlink" call created).
 *   propertyName - frontmatter property to remove. Default: "related".
 *
 * EXAMPLES:
 *   <%* await tp.user.clear_folder_note_links(tp, "ME") %>
 *     Removes "related" from every note DIRECTLY inside "ME".
 *
 *   <%* await tp.user.clear_folder_note_links(tp, "School", true) %>
 *     Removes "related" from "School" and every note in every subfolder
 *     beneath it, at any depth.
 *
 *   <%* await tp.user.clear_folder_note_links(tp, "/", true) %>
 *     Removes "related" from EVERY note in the entire vault. Use with care.
 *
 * This only deletes the named property — it does not touch any other
 * frontmatter or the note body, and never deletes a note.
 */

async function clear_folder_note_links(tp, scopeFolder, recursive = false, propertyName = "related") {
    const app = tp.app;
    const vault = app.vault;

    const normalizedScope = scopeFolder === "/" ? "" : scopeFolder.replace(/\/$/, "");

    const allFiles = vault.getMarkdownFiles();

    let targetFiles;
    if (recursive) {
        targetFiles = allFiles.filter(f => {
            if (normalizedScope === "") return true;
            return f.path === `${normalizedScope}/${f.name}` || f.path.startsWith(`${normalizedScope}/`);
        });
    } else {
        // Mirror backlink_to_folder_note's non-recursive scope logic exactly,
        // so "clear" always undoes what the matching "backlink" call did.
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

    let cleared = 0;
    let skippedNoProperty = 0;

    for (const file of targetFiles) {
        let didClear = false;
        await app.fileManager.processFrontMatter(file, (fm) => {
            if (Object.prototype.hasOwnProperty.call(fm, propertyName)) {
                delete fm[propertyName];
                didClear = true;
            }
        });

        if (didClear) {
            cleared++;
        } else {
            skippedNoProperty++;
        }
    }

    const summary = `Cleared "${propertyName}" from ${cleared} note(s). ` +
        `Skipped ${skippedNoProperty} note(s) that had no "${propertyName}" property.`;

    console.log(`clear_folder_note_links: ${summary}`);
    new Notice(summary, 8000);
}

module.exports = clear_folder_note_links;
