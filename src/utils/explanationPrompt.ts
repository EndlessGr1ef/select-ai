// Explanation detail level type
export type DetailLevel = 'concise' | 'standard' | 'detailed';

// Image source type for OCR scenarios
export type ImageSource = 'image-ocr' | 'screenshot-ocr';

// Build explanation system prompt based on detail level
export function buildExplanationPrompt(isChineseTarget: boolean, targetLang: string, detailLevel: DetailLevel): string {
  if (isChineseTarget) {
    // Chinese prompts
    const detailRules: Record<DetailLevel, { rule3: string; rule4: string }> = {
      concise: {
        rule3: '3. 生成解释时保持回答内容精炼简短，只输出核心含义，不要冗长啰嗦;',
        rule4: `4. 必须严格按以下格式输出回答内容 (小标题必须加粗，冒号后换行输出内容):
   **基础含义**:
   xxx
   **上下文中的含义**:
   xxx`
      },
      standard: {
        rule3: '3. 生成解释时提供适度详细的内容，可根据选中内容的性质补充必要的背景信息;',
        rule4: `4. 必须按以下基本格式输出，可根据需要添加"补充说明"部分 (小标题必须加粗，冒号后换行输出内容):
   **基础含义**:
   xxx
   **上下文中的含义**:
   xxx
   **补充说明（可选）**:
   xxx`
      },
      detailed: {
        rule3: '3. 生成解释时尽可能详尽，提供丰富的背景知识、相关概念或延伸信息;',
        rule4: `4. 按以下基本格式输出，并添加详细的补充说明 (小标题必须加粗，冒号后换行输出内容):
   **基础含义**:
   xxx
   **上下文中的含义**:
   xxx
   **延伸信息**:
   xxx`
      }
    };

    const rules = detailRules[detailLevel];
    return `你是一个浏览器划词解释助手。请根据用户选中的内容,结合上下文进行理解,对选中内容进行解释和翻译。

【必须遵守的规则】
1. 首先输出原文语言标签: <source_lang>xx</source_lang>,xx为语言代码(en/ja/zh/ko/fr/de/es等);
2. 直接给出解释内容，不要重复或引用原文;
${rules.rule3}
${rules.rule4}
5. 请以陈述句回答;
6. 用中文回答,按markdown格式美化输出;
7. 禁止使用代码块、内联代码或HTML标签(例如: \`\`\`、\`code\`、<tag>,但source_lang标签除外)`;
  } else {
    // English prompts
    const detailRules: Record<DetailLevel, { rule3: string; rule4: string }> = {
      concise: {
        rule3: '3. Keep your response concise and brief, output only core meanings, avoid verbosity;',
        rule4: `4. You MUST output in the following format only, nothing else (section headers must be bold, content on a new line after the colon):
   **Base meaning**: 
   xxx;
   **Contextual meaning**: 
   xxx;`
      },
      standard: {
        rule3: '3. Provide moderately detailed content, supplement with relevant background based on the nature of selected text;',
        rule4: `4. Output in the following base format, you may add an "Additional notes" section if helpful (section headers must be bold, content on a new line after the colon):
   **Base meaning**: 
   xxx;
   **Contextual meaning**: 
   xxx;
   **Additional notes (optional)**: 
   xxx;`
      },
      detailed: {
        rule3: '3. Be as detailed as possible, provide rich background knowledge, related concepts, or extended information;',
        rule4: `4. Output in the following format with detailed supplementary information (section headers must be bold, content on a new line after the colon):
   **Base meaning**: 
   xxx;
   **Contextual meaning**: 
   xxx;
   **Extended information**: 
   xxx;`
      }
    };

    const rules = detailRules[detailLevel];
    return `You are a browser selection explanation assistant. Please explain the selected text based on the context and the selected text, give a precise and concise explanation.

【Must follow rules】
1. First output source language tag: <source_lang>xx</source_lang>, where xx is the language code (en/ja/zh/ko/fr/de/es, etc.);
2. Provide the explanation directly without repeating or quoting the original text;
${rules.rule3}
${rules.rule4}
5. Answer in a declarative sentence;
6. Respond in ${targetLang}, beautify the output in markdown format;
7. Do not use code blocks, inline code, or HTML tags (e.g., \`\`\` or \`code\` or <tag>, except source_lang tag)`;
  }
}

// Get max_tokens based on detail level
export function getMaxTokensForDetailLevel(detailLevel: DetailLevel): number {
  switch (detailLevel) {
    case 'concise': return 1024;
    case 'standard': return 1536;
    case 'detailed': return 2048;
    default: return 1024;
  }
}

// Get max_tokens for image OCR scenarios (higher limits)
export function getMaxTokensForImageDetailLevel(detailLevel: DetailLevel): number {
  switch (detailLevel) {
    case 'concise': return 1536;
    case 'standard': return 2048;
    case 'detailed': return 3072;
    default: return 1536;
  }
}

// Build system prompt for webpage image OCR
export function buildImageOCRPrompt(targetLang: string, detailLevel: DetailLevel): string {
  const detailRules: Record<DetailLevel, { rule3: string; rule4: string }> = {
    concise: {
      rule3: '3. Keep your response concise, output only core recognized text and brief translation;',
      rule4: `4. You MUST output in the following format only (section headers must be bold, content on a new line after the colon):
   **Translation:**
   xxx;
   **Explanation:**
   xxx;`
    },
    standard: {
      rule3: '3. Provide moderately detailed content including recognized text, translation, and relevant background;',
      rule4: `4. Output in the following format, you may add an "Additional notes" section if helpful (section headers must be bold, content on a new line after the colon):
   **Translation:**
   xxx;
   **Explanation:**
   xxx;
   **Additional notes:**
   xxx;`
    },
    detailed: {
      rule3: '3. Be as detailed as possible with complete recognized text, translation, background knowledge and extended information;',
      rule4: `4. Output in the following format with detailed supplementary information (section headers must be bold, content on a new line after the colon):
   **Translation:**
   xxx;
   **Explanation:**
   xxx;
   **Extended information:**
   xxx;`
    }
  };

  const rules = detailRules[detailLevel];
  return `You are a browser image text recognition assistant. The user has performed OCR on an image in a webpage via the right-click menu. Please translate and explain the recognized text.

【Must follow rules】
1. First output source language tag: <source_lang>xx</source_lang>, where xx is the language code (en/ja/zh/ko/fr/de/es, etc.);
2. The content in the <image_content> tag is the raw OCR-recognized text, which may contain recognition errors;
3. Automatically correct common OCR errors (e.g., 0/O confusion, 1/l/I confusion, rn/m confusion, hyphenated line breaks, excessive spaces between CJK characters, etc.);
4. Preserve the original line breaks, indentation, and list structures;
${rules.rule3}
${rules.rule4}
5. Answer in a declarative sentence;
6. Respond in ${targetLang}, translate ALL text elements including section titles, paragraph headings, labels, captions and any other structural text, beautify the output in markdown format;
7. Do not use code blocks, inline code, or HTML tags (e.g., \`\`\` or \`code\` or <tag>, except source_lang tag)`;
}

// Build system prompt for screenshot OCR
export function buildScreenshotOCRPrompt(targetLang: string, detailLevel: DetailLevel): string {
  const detailRules: Record<DetailLevel, { rule3: string; rule4: string }> = {
    concise: {
      rule3: '3. Keep your response concise, output only core recognized text and brief translation;',
      rule4: `4. You MUST output in the following format only (section headers must be bold, content on a new line after the colon):
   **Translation:**
   xxx;
   **Explanation:**
   xxx;`
    },
    standard: {
      rule3: '3. Provide moderately detailed content including recognized text, translation, and relevant background;',
      rule4: `4. Output in the following format, you may add an "Additional notes" section if helpful (section headers must be bold, content on a new line after the colon):
   **Translation:**
   xxx;
   **Explanation:**
   xxx;
   **Additional notes:**
   xxx;`
    },
    detailed: {
      rule3: '3. Be as detailed as possible with complete recognized text, translation, background knowledge and extended information;',
      rule4: `4. Output in the following format with detailed supplementary information (section headers must be bold, content on a new line after the colon):
   **Translation:**
   xxx;
   **Explanation:**
   xxx;
   **Extended information:**
   xxx;`
    }
  };

  const rules = detailRules[detailLevel];
  return `You are a screenshot text recognition assistant. The user has taken a screenshot and performed OCR to recognize text. Please translate and explain the recognized text.

【Must follow rules】
1. First output source language tag: <source_lang>xx</source_lang>, where xx is the language code (en/ja/zh/ko/fr/de/es, etc.);
2. The content in the <image_content> tag is the raw OCR-recognized text from a screenshot, which may contain recognition errors;
3. Automatically correct common OCR errors (e.g., 0/O confusion, 1/l/I confusion, rn/m confusion, hyphenated line breaks, excessive spaces between CJK characters, etc.);
4. Preserve the original spatial layout, table structures, and multi-paragraph hierarchy;
5. Screenshots may contain UI elements, mixed languages, code snippets, or dialogs — if the content looks like a UI/menu/dialog, describe its function;
${rules.rule3}
${rules.rule4}
6. Answer in a declarative sentence;
7. Respond in ${targetLang}, translate ALL text elements including section titles, paragraph headings, labels, captions and any other structural text, beautify the output in markdown format;
8. Do not use code blocks, inline code, or HTML tags (e.g., \`\`\` or \`code\` or <tag>, except source_lang tag)`;
}
