(function () {
  const levelNames = {
    1: "Alphabet & Pronunciation",
    5: "Colors and Object Description",
    8: "Countries",
    9: "Daily Activities",
    10: "Self Introduction",
    11: "Workplace Phrases",
    12: "Grammar in Conversation",
    13: "Meeting Communication",
    14: "Office Roleplay",
    15: "English Day Challenge",
    16: "Explaining Constraints",
    17: "Clarifying Requirements",
    18: "Offering Alternatives",
    19: "Professional Feedback",
    20: "Fluency Showcase"
  };

  const bank = [];
  const pad = (num) => String(num).padStart(3, "0");
  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
  const add = (sourceId, source, world, level, type, skill, difficulty, title, body) => {
    const count = bank.filter(q => q.sourceId === sourceId).length + 1;
    bank.push({
      id: `${sourceId}_${type}_l${level}_q${pad(count)}`,
      sourceId,
      source,
      world,
      level,
      levelName: levelNames[level] || `Level ${level}`,
      type,
      skill,
      difficulty,
      title,
      xp: type === "speaking" || type === "roleplay" || type === "pronunciation" ? 15 : 10,
      ...body
    });
  };
  const mcq = (answer, distractors) => shuffle([answer, ...distractors]).slice(0, 4);

  const bedroom = [
    ["bedroom", "kamar tidur", "This is a bedroom."],
    ["bed", "tempat tidur", "A bed is used for sleeping or resting."],
    ["mattress", "kasur", "A mattress is the soft part of a bed."],
    ["pillow", "bantal", "A pillow is placed under your head."],
    ["bedsheet", "sprei", "A bedsheet covers the mattress."],
    ["blanket", "selimut", "A blanket keeps you warm."],
    ["duvet", "selimut tebal", "A duvet is a warm blanket."],
    ["nightstand", "meja kecil di samping tempat tidur", "A nightstand is next to the bed."],
    ["lamp", "lampu", "A lamp gives light."],
    ["alarm clock", "jam alarm", "An alarm clock helps you wake up."],
    ["mirror", "cermin", "You can see yourself in a mirror."],
    ["shelf", "rak", "A shelf holds items."],
    ["wardrobe", "lemari pakaian", "A wardrobe stores clothes."],
    ["hanger", "gantungan baju", "A hanger holds clothes inside a wardrobe."],
    ["curtains", "tirai", "Curtains are near the window."],
    ["drawer", "laci", "A drawer is used for storage."],
    ["fan", "kipas angin", "A fan keeps the room cool."],
    ["air conditioner", "AC", "An air conditioner keeps the room cool."],
    ["comfortable", "nyaman", "A comfortable room is good for resting."],
    ["clean", "bersih", "A clean bedroom looks neat."]
  ];
  bedroom.slice(0, 10).forEach(([term, meaning, explanation], i) => add("bedroom_vocab", "BEDROOM VOCAB", 1, [5, 8, 9, 10][i % 4], "vocab", "vocabulary", "easy", "Vocabulary Hunter", {
    prompt: `What is the meaning of '${term}'?`,
    options: mcq(meaning, bedroom.filter(b => b[1] !== meaning).map(b => b[1])),
    answer: meaning,
    explanation
  }));
  bedroom.slice(10, 20).forEach(([term, meaning, explanation], i) => add("bedroom_vocab", "BEDROOM VOCAB", 1, [5, 8, 9, 10][i % 4], "reading", "reading", "easy", "Reading Comprehension", {
    prompt: `Read the bedroom text. Which item means '${meaning}'?`,
    options: mcq(term, bedroom.filter(b => b[0] !== term).map(b => b[0])),
    answer: term,
    explanation
  }));
  [
    "This is a bedroom",
    "There is a bed in the center",
    "The pillow is on the bed",
    "The curtains are near the window",
    "The wardrobe has hangers inside",
    "The drawer is for storage",
    "The lamp is on the nightstand",
    "The bedroom looks clean",
    "The room is comfortable",
    "The fan keeps the room cool"
  ].forEach((sentence, i) => add("bedroom_vocab", "BEDROOM VOCAB", 1, [5, 8, 9, 10][i % 4], "sentence", "sentence", "easy", "Sentence Builder", {
    prompt: "Arrange the words into a correct sentence.",
    words: shuffle(sentence.split(" ")),
    answer: sentence,
    explanation: `Correct sentence: ${sentence}.`
  }));
  [
    ["The bed is in the center of the bedroom.", "The bed is in the center of the bedroom."],
    ["There is a lamp on the nightstand.", "There is a lamp on the nightstand."],
    ["Curtains are near the window.", "Curtains are near the window."],
    ["A wardrobe stores clothes.", "A wardrobe stores clothes."],
    ["The bedroom is clean and comfortable.", "The bedroom is clean and comfortable."]
  ].forEach(([speak, answer], i) => add("bedroom_vocab", "BEDROOM VOCAB", 1, [5, 8, 9, 10][i % 4], "listening", "listening", "easy", "Listening Practice", {
    prompt: "Listen and choose the sentence you hear.",
    speak,
    options: mcq(answer, ["The kitchen is very noisy.", "The report is not ready.", "The meeting starts tomorrow.", "The client wants red lines."]),
    answer,
    explanation: `The audio says: ${answer}`
  }));
  [
    "Describe your bedroom in 3 simple sentences.",
    "Describe the bed and items on it.",
    "Describe where the curtains are.",
    "Describe why the room is comfortable.",
    "Describe one item you use for storage."
  ].forEach((prompt, i) => add("bedroom_vocab", "BEDROOM VOCAB", 1, [5, 8, 9, 10][i % 4], "speaking", "speaking", "easy", "Speaking Description", {
    prompt,
    expectedAnswer: "This is my bedroom. There is a bed and a wardrobe. My bedroom is clean and comfortable.",
    rubric: ["clarity", "vocabulary", "fluency"],
    exampleAnswer: "This is my bedroom. I have a bed, a pillow, and a wardrobe. My room is comfortable.",
    explanation: "Use simple bedroom vocabulary and clear sentences."
  }));

  const prepPairs = [
    ["good", "at", "He is good at singing."],
    ["bad", "at", "I am bad at remembering names."],
    ["amazing", "at", "She is amazing at painting."],
    ["angry", "about", "They are angry about the delay."],
    ["excited", "about", "We are excited about the concert."],
    ["worried", "about", "I am worried about the schedule."],
    ["afraid", "of", "I am afraid of spiders."],
    ["proud", "of", "She is proud of her team."],
    ["scared", "of", "He is scared of heights."],
    ["interested", "in", "She is interested in photography."],
    ["married", "to", "He is married to a dentist."],
    ["responsible", "for", "They are responsible for the schedule."],
    ["rude", "to", "He was rude to the teacher."],
    ["famous", "for", "The city is famous for its architecture."],
    ["allergic", "to", "I am allergic to peanuts."],
    ["tired", "of", "We are tired of waiting."],
    ["polite", "to", "Please be polite to visitors."]
  ];
  const prepOptions = ["at", "about", "of", "in", "to", "for"];
  for (let i = 0; i < 20; i++) {
    const [adj, prep, sentence] = prepPairs[i % prepPairs.length];
    add("adjectives_prepositions", "Adjectives + Prepositions", i < 10 ? 1 : 2, [9, 10, 11, 12][i % 4], "grammar", "grammar", i < 12 ? "easy" : "medium", "Grammar Battle", {
      prompt: sentence.replace(` ${prep} `, " ___ "),
      options: mcq(prep, prepOptions.filter(p => p !== prep)),
      answer: prep,
      explanation: `The correct phrase is '${adj} ${prep}'.`
    });
  }
  for (let i = 0; i < 20; i++) {
    const [adj, prep, sentence] = prepPairs[(i + 5) % prepPairs.length];
    add("adjectives_prepositions", "Adjectives + Prepositions", i < 8 ? 1 : 2, [9, 10, 11, 12][i % 4], "listening", "listening", "medium", "Listening Grammar", {
      prompt: "Listen and choose the complete sentence.",
      speak: sentence,
      options: mcq(sentence, [
        sentence.replace(` ${prep} `, " at "),
        sentence.replace(` ${prep} `, " of "),
        sentence.replace(` ${prep} `, " for ")
      ].filter(s => s !== sentence)),
      answer: sentence,
      explanation: `The audio uses '${adj} ${prep}'.`
    });
  }
  for (let i = 0; i < 10; i++) {
    const [adj, prep, sentence] = prepPairs[(i + 9) % prepPairs.length];
    const wrong = sentence.replace(` ${prep} `, " in ");
    add("adjectives_prepositions", "Adjectives + Prepositions", 2, [9, 10, 11, 12][i % 4], "reading", "grammar", "medium", "Error Correction", {
      prompt: `Choose the correct sentence.`,
      options: mcq(sentence, [wrong, sentence.replace(` ${prep} `, " about "), sentence.replace(` ${prep} `, " to ")]),
      answer: sentence,
      explanation: `Use '${adj} ${prep}', so the correct sentence is: ${sentence}`
    });
  }
  for (let i = 0; i < 10; i++) {
    const [, , sentence] = prepPairs[(i + 2) % prepPairs.length];
    add("adjectives_prepositions", "Adjectives + Prepositions", 2, [9, 10, 11, 12][i % 4], "sentence", "writing", "medium", "Sentence Completion", {
      prompt: "Arrange the words into a correct grammar sentence.",
      words: shuffle(sentence.replace(".", "").split(" ")),
      answer: sentence.replace(".", ""),
      explanation: `Correct sentence: ${sentence}`
    });
  }

  const phrases = [
    ["Could you clarify that?", "Use this when instructions are unclear."],
    ["Let me make sure I understand.", "Use this to confirm meaning."],
    ["I am afraid that may not be feasible.", "Use this for polite disagreement."],
    ["Could we consider another option?", "Use this to offer an alternative."],
    ["I can prepare a draft first.", "Use this when time is limited."],
    ["May I confirm the deadline?", "Use this to ask about time."],
    ["Thank you for the explanation.", "Use this after someone clarifies."],
    ["Could you explain it again?", "Use this when you need repetition."],
    ["That sounds reasonable.", "Use this to agree politely."],
    ["I will follow up after the meeting.", "Use this to close a discussion."]
  ];
  phrases.forEach(([phrase, explanation], i) => add("phrases", "Phrases", 2, 11 + (i % 5), i % 2 ? "listening" : "vocab", i % 2 ? "listening" : "conversation", "easy", "Office Phrases", {
    prompt: i % 2 ? "Listen and choose the office phrase." : `When should you use: '${phrase}'?`,
    speak: phrase,
    options: i % 2 ? mcq(phrase, phrases.filter(p => p[0] !== phrase).map(p => p[0])) : mcq(explanation, phrases.filter(p => p[1] !== explanation).map(p => p[1])),
    answer: i % 2 ? phrase : explanation,
    explanation
  }));
  for (let i = 0; i < 5; i++) add("phrases", "Phrases", 2, 11 + i, "roleplay", "roleplay", "medium", "Conversation Practice", {
    prompt: `Roleplay: your colleague gives unclear instructions. Use this phrase: '${phrases[i][0]}'`,
    expectedAnswer: `${phrases[i][0]} I want to make sure I can do the task correctly.`,
    rubric: ["politeness", "clarity", "workplace context"],
    exampleAnswer: `${phrases[i][0]} Could you give one example, please?`,
    explanation: phrases[i][1]
  });
  for (let i = 0; i < 5; i++) add("phrases", "Phrases", 2, 11 + i, "speaking", "speaking", "medium", "English Day Challenge", {
    prompt: `Say a short workplace sentence using: '${phrases[i + 5][0]}'`,
    expectedAnswer: `${phrases[i + 5][0]} I will update you soon.`,
    rubric: ["pronunciation", "clarity", "confidence"],
    exampleAnswer: `${phrases[i + 5][0]} I will send the result after lunch.`,
    explanation: phrases[i + 5][1]
  });

  const twisters = [
    "Red lorry, yellow lorry",
    "She sells seashells by the seashore",
    "A proper copper coffee pot",
    "Fresh fried fish",
    "Clean clams crammed in cans",
    "Thirty-three thousand feathers",
    "Big black bug bit a big black bear",
    "Please pay promptly",
    "Customs officers check cargo carefully",
    "Clear communication creates confidence"
  ];
  for (let i = 0; i < 5; i++) add("tongue_twisters", "Tongue Twisters", i < 2 ? 1 : 2, [1, 10, 20][i % 3], "pronunciation", "pronunciation", "medium", "Pronunciation Challenge", {
    prompt: `Say this tongue twister clearly: ${twisters[i]}`,
    expectedAnswer: twisters[i],
    rubric: ["clarity", "rhythm", "accuracy"],
    exampleAnswer: twisters[i],
    explanation: "Focus on clear sounds, not speed."
  });
  for (let i = 5; i < 10; i++) add("tongue_twisters", "Tongue Twisters", 2, [1, 10, 20][i % 3], "speaking", "fluency", "hard", "Fluency Practice", {
    prompt: `Practice fluency with this line: ${twisters[i]}`,
    expectedAnswer: twisters[i],
    rubric: ["fluency", "clarity", "confidence"],
    exampleAnswer: twisters[i],
    explanation: "Repeat slowly first, then increase speed."
  });
  for (let i = 0; i < 5; i++) add("tongue_twisters", "Tongue Twisters", 2, [1, 10, 20][i % 3], "listening", "listening", "medium", "Pronunciation Listening", {
    prompt: "Listen and choose the tongue twister.",
    speak: twisters[i + 2],
    options: mcq(twisters[i + 2], twisters.filter(t => t !== twisters[i + 2])),
    answer: twisters[i + 2],
    explanation: `The line is: ${twisters[i + 2]}`
  });

  const workplace = [
    ["The data is not ready yet.", "Explain a constraint clearly."],
    ["Could we move the deadline to tomorrow?", "Offer a realistic alternative."],
    ["I can send the summary first.", "Offer partial output."],
    ["The requirement is unclear.", "Clarify a problem."],
    ["Let me confirm the priority.", "Ask for priority."],
    ["This option may not be feasible.", "Politely explain limitation."],
    ["We need more information from the client.", "Explain dependency."],
    ["I will prepare the draft today.", "Commit to a next action."],
    ["Could you clarify the expected format?", "Ask a clear question."],
    ["The schedule is too tight.", "Explain time constraint."]
  ];
  for (let i = 0; i < 5; i++) add("workplace_communication", "English for Workplace Communication", 2, 16 + i, "reading", "reading", "medium", "Workplace Communication", {
    prompt: `What is the purpose of this sentence: '${workplace[i][0]}'?`,
    options: mcq(workplace[i][1], workplace.filter(w => w[1] !== workplace[i][1]).map(w => w[1])),
    answer: workplace[i][1],
    explanation: workplace[i][1]
  });
  for (let i = 5; i < 10; i++) add("workplace_communication", "English for Workplace Communication", 2, 16 + (i % 5), "listening", "listening", "medium", "Workplace Listening", {
    prompt: "Listen and choose the workplace sentence.",
    speak: workplace[i][0],
    options: mcq(workplace[i][0], workplace.filter(w => w[0] !== workplace[i][0]).map(w => w[0])),
    answer: workplace[i][0],
    explanation: workplace[i][1]
  });
  for (let i = 0; i < 5; i++) add("workplace_communication", "English for Workplace Communication", 2, 16 + i, i % 2 ? "roleplay" : "speaking", i % 2 ? "roleplay" : "speaking", "medium", "Workplace Roleplay", {
    prompt: `Your leader asks for a big report in one hour. Use this idea: '${workplace[i][0]}'`,
    expectedAnswer: `${workplace[i][0]} I can offer an alternative plan.`,
    rubric: ["politeness", "clarity", "alternative solution"],
    exampleAnswer: `${workplace[i][0]} I can send the summary first and complete the details later.`,
    explanation: workplace[i][1]
  });

  window.DRIVE_QUESTION_BANK = bank;
})();
