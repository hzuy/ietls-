export const questionTypes = [
  {
    key: "true_false_ng",
    label: "True / False / Not Given",
    skills: ["reading"]
  },
  {
    key: "yes_no_ng",
    label: "Yes / No / Not Given",
    skills: ["reading"]
  },
  {
    key: "mcq",
    label: "Multiple Choice",
    skills: ["reading", "listening"]
  },
  {
    key: "note_completion",
    label: "Note Completion",
    skills: ["reading", "listening"]
  },
  {
    key: "table_completion",
    label: "Table Completion",
    skills: ["reading", "listening"]
  },
  {
    key: "matching",
    label: "Matching",
    skills: ["listening"]
  },
  {
    key: "map_labeling",
    label: "Map / Diagram Labeling",
    skills: ["reading", "listening"]
  },
  {
    key: "drag_word_bank",
    label: "Summary + Word Bank",
    skills: ["reading", "listening"]
  },
  {
    key: "matching_drag",
    label: "Matching Drag",
    skills: ["reading", "listening"]
  },
  {
    key: "diagram_label",
    label: "Diagram Label Completion",
    skills: ["reading", "listening"]
  }
];

export const getTypesBySkill = (skill) => {
  return questionTypes.filter(type => type.skills.includes(skill));
};
