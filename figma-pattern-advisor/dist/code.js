"use strict";
(() => {
  // src/plugin/code.ts
  figma.showUI(__html__, { width: 400, height: 600, themeColors: true });
  function extractContext() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.ui.postMessage({ type: "SELECTION_EMPTY" });
      return;
    }
    const contextData = {
      nodeNames: [],
      textContents: [],
      componentNames: [],
      frameNames: []
    };
    function traverse(node) {
      contextData.nodeNames.push(node.name.toLowerCase());
      if (node.type === "TEXT") {
        contextData.textContents.push(node.characters.toLowerCase());
      }
      if (node.type === "COMPONENT" || node.type === "INSTANCE") {
        contextData.componentNames.push(node.name.toLowerCase());
      }
      if (node.type === "FRAME") {
        contextData.frameNames.push(node.name.toLowerCase());
      }
      if ("children" in node) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
    for (const node of selection) {
      traverse(node);
    }
    figma.ui.postMessage({
      type: "CONTEXT_EXTRACTED",
      payload: contextData
    });
  }
  figma.on("selectionchange", () => {
    extractContext();
  });
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "INSERT_COMPONENT") {
      const key = msg.componentKey;
      const id = msg.componentId;
      if (!key) {
        figma.notify("Error: componentKey is empty. Add it to patterns.json", { error: true });
        figma.ui.postMessage({ type: "INSERT_DONE" });
        return;
      }
      try {
        let instance = null;
        try {
          const importComponent = await figma.importComponentByKeyAsync(key);
          instance = importComponent.createInstance();
        } catch (e) {
          if (id) {
            const localNode = figma.getNodeById(id);
            if (localNode && localNode.type === "COMPONENT") {
              instance = localNode.createInstance();
            } else if (localNode && localNode.type === "COMPONENT_SET") {
              instance = localNode.defaultVariant.createInstance();
            } else {
              throw new Error("Library not published and component not found locally.");
            }
          } else {
            throw e;
          }
        }
        if (instance) {
          instance.x = figma.viewport.center.x;
          instance.y = figma.viewport.center.y;
          figma.currentPage.selection = [instance];
          figma.notify("Component inserted successfully!");
        }
      } catch (e) {
        figma.notify("Error: Please publish this file as a Team Library first!", { error: true });
        console.error(e);
      }
      figma.ui.postMessage({ type: "INSERT_DONE" });
    } else if (msg.type === "SYNC_LIBRARY") {
      const components = figma.root.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
      const database = [];
      for (const comp of components) {
        const name = comp.name;
        const desc = comp.description || `Auto-synced component: ${name}`;
        const signals = {};
        const words = name.toLowerCase().split(/[\s_\-\/]+/);
        words.forEach((w) => {
          if (w.length > 2) {
            signals[w] = 10;
          }
        });
        database.push({
          patternId: `auto.${comp.key}`,
          name,
          version: "1.0",
          componentKey: comp.key,
          componentId: comp.id,
          signals,
          requiredAnatomy: ["Component instances (Auto)"],
          antiPatterns: [],
          explanation: desc
        });
      }
      await figma.clientStorage.setAsync("pattern_database", database);
      figma.ui.postMessage({ type: "DATABASE_LOADED", database });
      figma.notify(`Synced ${database.length} components to Pattern Database!`);
    }
  };
})();
