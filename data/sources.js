(function () {
  window.QUESTION_SOURCES = [
    {
      id: "bedroom_vocab",
      name: "BEDROOM VOCAB",
      category: "Vocabulary and Reading",
      difficultyRange: ["easy", "medium"],
      skills: ["vocabulary", "reading", "sentence", "speaking"]
    },
    {
      id: "worksheet_grammar",
      name: "Worksheet Grammar",
      category: "Grammar",
      difficultyRange: ["medium", "hard"],
      skills: ["grammar", "sentence"]
    },
    {
      id: "phrases",
      name: "Phrases",
      category: "Conversation",
      difficultyRange: ["medium", "hard"],
      skills: ["speaking", "roleplay", "conversation"]
    },
    {
      id: "tongue_twisters",
      name: "Tongue Twisters",
      category: "Pronunciation",
      difficultyRange: ["hard"],
      skills: ["pronunciation", "speaking", "fluency"]
    },
    {
      id: "workplace_communication",
      name: "English for Workplace Communication",
      category: "Workplace English",
      difficultyRange: ["medium", "hard", "advanced"],
      skills: ["speaking", "listening", "writing", "grammar", "roleplay"]
    }
  ];

  window.LEVEL_DEFS = [
    { level: 1, world: 1, name: "Workplace Warm-up", difficulty: "easy", cefr: "A2", focus: "Workplace vocabulary and simple phrases", sourcePriority: ["Phrases", "English for Workplace Communication"] },
    { level: 2, world: 1, name: "Vocabulary in Context", difficulty: "easy-medium", cefr: "A2", focus: "BEDROOM VOCAB and object description", sourcePriority: ["BEDROOM VOCAB"] },
    { level: 3, world: 1, name: "Reading and Description", difficulty: "medium", cefr: "A2-B1", focus: "Short reading comprehension and descriptive paragraph", sourcePriority: ["BEDROOM VOCAB"] },
    { level: 4, world: 1, name: "Sentence Builder", difficulty: "medium", cefr: "B1", focus: "Descriptive and workplace sentence arrangement", sourcePriority: ["BEDROOM VOCAB", "English for Workplace Communication"] },
    { level: 5, world: 1, name: "Grammar Pattern 1", difficulty: "medium", cefr: "B1", focus: "Basic adjectives + prepositions", sourcePriority: ["Worksheet Grammar"] },
    { level: 6, world: 1, name: "Grammar Pattern 2", difficulty: "medium-hard", cefr: "B1", focus: "Advanced adjectives + prepositions", sourcePriority: ["Worksheet Grammar"] },
    { level: 7, world: 1, name: "Office Phrases and Conversation", difficulty: "medium-hard", cefr: "B1", focus: "Polite request, clarification, help, agreement, disagreement", sourcePriority: ["Phrases", "English for Workplace Communication"] },
    { level: 8, world: 1, name: "Listening and Pronunciation", difficulty: "hard", cefr: "B1-B2", focus: "Tongue twisters, listening, repeat-after-speaker, fluency", sourcePriority: ["Tongue Twisters"] },
    { level: 9, world: 1, name: "Roleplay and Workplace Case", difficulty: "hard", cefr: "B2", focus: "Meeting, service, email, telephone, stakeholder cases", sourcePriority: ["English for Workplace Communication", "Phrases"] },
    { level: 10, world: 1, name: "CEC Boss Challenge", difficulty: "advanced", cefr: "B2", focus: "Mini presentation, speaking description, and English Day challenge", sourcePriority: ["English for Workplace Communication", "BEDROOM VOCAB", "Tongue Twisters"] }
  ];
})();
