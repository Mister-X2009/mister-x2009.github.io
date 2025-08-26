// retro_blocks.js

// RetroGadgets Blöcke im Retro-Style mit Multi-Tasten-Matrix, leuchtenden Buttons, Events und Animationen
const retroGadgetsTabs = [
  {
    category: "CPU",
    colour: 50, // retro green
    blocks: [
      { type: "cpu_block", message0: "CPU(%1)", args0: [{ type: "field_number", name: "ID", value: 0 }], previousStatement: null, nextStatement: null, colour: 50 }
    ]
  },
  {
    category: "Buttons",
    colour: 200, // neon blue
    blocks: [
      { type: "set_button_light", message0: "Button Light x %1 y %2 Farbe %3", args0: [{ type: "field_number", name: "X", value: 0 }, { type: "field_number", name: "Y", value: 0 }, { type: "field_colour", name: "COLOR", colour: "#00ffff" }], previousStatement: null, nextStatement: null, colour: 200 },
      { type: "button_pressed", message0: "Taste x %1 y %2 gedrückt?", args0: [{ type: "field_number", name: "X", value: 0 }, { type: "field_number", name: "Y", value: 0 }], output: "Boolean", colour: 200 },
      { type: "multi_button_event", message0: "Tasten gedrückt: %1", args0: [{ type: "input_value", name: "BUTTONS" }], previousStatement: null, nextStatement: null, colour: 200 }
    ]
  },
  {
    category: "Display",
    colour: 120, // neon green
    blocks: [
      { type: "draw_pixel", message0: "Pixel x %1 y %2 Farbe %3", args0: [{ type: "field_number", name: "X", value: 0 }, { type: "field_number", name: "Y", value: 0 }, { type: "field_colour", name: "COLOR", colour: "#00ff00" }], previousStatement: null, nextStatement: null, colour: 120 },
      { type: "draw_text", message0: "Text %1 bei x %2 y %3", args0: [{ type: "field_input", name: "TEXT", text: "Hallo" }, { type: "field_number", name: "X", value: 0 }, { type: "field_number", name: "Y", value: 0 }], previousStatement: null, nextStatement: null, colour: 120 },
      { type: "draw_animation", message0: "Animation %1 bei x %2 y %3 Geschwindigkeit %4", args0: [{ type: "field_input", name: "ANIM", text: "Walk" }, { type: "field_number", name: "X", value: 0 }, { type: "field_number", name: "Y", value: 0 }, { type: "field_number", name: "SPEED", value: 1 }], previousStatement: null, nextStatement: null, colour: 120 }
    ]
  },
  {
    category: "Update",
    colour: 160, // neon pink
    blocks: [
      { type: "update_loop", message0: "update()", previousStatement: null, nextStatement: null, colour: 160 },
      { type: "on_event", message0: "Event %1 ausführen", args0: [{ type: "field_input", name: "EVENT", text: "onPress" }], previousStatement: null, nextStatement: null, colour: 160 }
    ]
  }
];

function addRetroGadgetsBlocks(workspace) {
  retroGadgetsTabs.forEach(tab => {
    Blockly.defineBlocksWithJsonArray(tab.blocks);
  });
}
