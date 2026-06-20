# Folder Note Backlink Generator Scripts
## Info
This is my current solution for turning the graph view into a visual representation of your note's folder structure. If you have in depth folder structuring like I do, and naming conventions so I can search for notes easily, then wouldn't it be nice if the graph view was instead just a visual of the file hierarchy so I can find things more easily without having to also backlink everything? I thought so so thats why I created these scripts as a temporary solution to this problem, until I find or make a more permenant solution.

## Problem
I already organize my notes by folders with a specific and very intent file structuring system. I wanted my graph view to be more or less a visual representation of the file structure. These scripts make the graph view represent the file structure automatically instead of having to create backlinks manually. 

## Dependencies
These scripts require you to have [LostPaul/Folder-Notes](https://github.com/LostPaul/obsidian-folder-notes/tree/main) and [SilentVoid13/Templater](https://github.com/SilentVoid13/Templater). They are both avaliable through the community plugins section in Obsidian

## Installation
- Create a Templates/Scripts folder and set the path in the Templater options

## Usage
- Create a new note anywhere
- Paste in one of the commands below
- Open Command Palette > Templater: Replace templates in active file


### Quickly Generate Entire Tree
```js
<%* await tp.user.clear_folder_note_links(tp, "/", true) %>
<%* await tp.user.backlink_to_folder_note(tp, "/", true) %>
```

## Commands
### Generate Folder Back links
```js
<%* await tp.user.backlink_to_folder_note(tp, "Folder_Path", false) %>
```
The false at the end can be replaced with true to make it recursive

### Clear Folder Note Links
```js
<%* await tp.user.clear_folder_note_links(tp, "Folder_Path", false) %>
```
The false at the end can be replaced with true to make it recursive

