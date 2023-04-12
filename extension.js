const vscode = require('vscode');

function activate(context) {
    const regionTreeDataProvider = new RegionTreeDataProvider();
    const regionTreeView = vscode.window.createTreeView('regionTreeView', {
        treeDataProvider: regionTreeDataProvider,
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('region-tree.show', () => {
            regionTreeView.reveal(undefined, { expand: true });
        }),
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            regionTreeDataProvider.refresh();
            regionTreeView.reveal(undefined, { expand: true });
        }),
    );

    // region 선택 시 포커스
    context.subscriptions.push(
        regionTreeView.onDidChangeSelection(async (e) => {
            if (e.selection && e.selection.length > 0) {
                const regionItem = e.selection[0];
                if (regionItem.range) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        editor.selection = new vscode.Selection(regionItem.range.start, regionItem.range.start);
                        editor.revealRange(regionItem.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
                    }
                }
            }
        }),
    );

    // 파일 오픈 시 tree 업데이트
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (vscode.window.activeTextEditor && document === vscode.window.activeTextEditor.document) {
                const newRegions = await regionTreeDataProvider.getRegions(document);
                regionTreeDataProvider.regions = newRegions;
                regionTreeDataProvider.refresh();
            }
        }),
    );

    // 파일 저장 시 tree 업데이트
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (document === vscode.window.activeTextEditor.document) {
                const newRegions = await regionTreeDataProvider.getRegions(document);
                regionTreeDataProvider.regions = newRegions;
                regionTreeDataProvider.refresh();
            }
        }),
    );

    // 파일 닫을 때 tree 삭제
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((document) => {
            console.log(`Document closed: ${document.uri.toString()}`);
            regionTreeDataProvider.regions = [];
            regionTreeDataProvider.refresh();
        }),
    );
}
class RegionTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.regions = [];
    }

    getTreeItem(element) {
        element.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        return element;
    }

    getChildren(element) {
        if (!element) {
            return this.regions;
        }
        return element.children;
    }

    async getRegions(document) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !document) {
            return [];
        }

        const text = document.getText();
        const lines = text.split(/\r?\n/);
        const regionItems = [];

        let stack = [];
        let isInHtmlComment = false; // html 주석 안에 있는지 여부를 나타내는 변수 추가
        lines.forEach((line, index) => {
            const regionMatch = line.match(/#region\s+(.*?)(\s*\*\/|\s*-->|\s*)$/i);
            const endregionMatch = line.match(/#endregion/);

            // html 주석이 시작될 때
            if (line.includes('<!--')) {
                isInHtmlComment = true;
            }

            // html 주석이 끝날 때
            if (line.includes('-->')) {
                isInHtmlComment = false;
            }

            if (regionMatch && !isInHtmlComment) {
                const regionItem = new vscode.TreeItem(
                    regionMatch[1] || `Region ${regionItems.length + 1}`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                );
                regionItem.range = new vscode.Range(index, 0, index, 0);
                regionItem.children = [];

                if (stack.length > 0) {
                    stack[stack.length - 1].children.push(regionItem);
                } else {
                    regionItems.push(regionItem);
                }
                stack.push(regionItem);
            } else if (endregionMatch && !isInHtmlComment) {
                stack.pop();
            }
        });

        return regionItems;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

exports.activate = activate;

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
