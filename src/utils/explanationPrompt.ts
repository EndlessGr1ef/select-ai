// Explanation detail level type
export type DetailLevel = 'concise' | 'standard' | 'detailed';

// Build explanation system prompt based on detail level
export function buildExplanationPrompt(isChineseTarget: boolean, targetLang: string, detailLevel: DetailLevel): string {
  if (isChineseTarget) {
    // Chinese prompts
    const detailRules: Record<DetailLevel, { rule3: string; rule4: string }> = {
      concise: {
        rule3: '3. 生成解释时保持回答内容精炼简短，只输出核心含义，不要冗长啰嗦;',
        rule4: `4. 必须严格按以下格式输出回答内容;
   基础含义:
   xxx
   上下文中的含义:
   xxx`
      },
      standard: {
        rule3: '3. 生成解释时提供适度详细的内容，可根据选中内容的性质补充必要的背景信息;',
        rule4: `4. 必须按以下基本格式输出，可根据需要添加"补充说明"部分;
   基础含义:
   xxx
   上下文中的含义:
   xxx
   补充说明（可选）:
   xxx`
      },
      detailed: {
        rule3: '3. 生成解释时尽可能详尽，提供丰富的背景知识、相关概念或延伸信息;',
        rule4: `4. 按以下基本格式输出，并添加详细的补充说明;
   基础含义:
   xxx
   上下文中的含义:
   xxx
   延伸信息:
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
7. 禁止使用代码块、内联代码或HTML标签(例如: \`\`\`、\`code\`、<tag>,但source_lang标签除外);
8. 当输入包含<image_content>标签时,说明用户选中的是图片中通过OCR识别出的文字,请优先对图片中的文字内容进行识别、翻译和解释,将其作为主要分析对象`;
  } else {
    // English prompts
    const detailRules: Record<DetailLevel, { rule3: string; rule4: string }> = {
      concise: {
        rule3: '3. Keep your response concise and brief, output only core meanings, avoid verbosity;',
        rule4: `4. You MUST output in the following format only, nothing else:
   Base meaning: 
   xxx;
   Contextual meaning: 
   xxx;`
      },
      standard: {
        rule3: '3. Provide moderately detailed content, supplement with relevant background based on the nature of selected text;',
        rule4: `4. Output in the following base format, you may add an "Additional notes" section if helpful:
   Base meaning: 
   xxx;
   Contextual meaning: 
   xxx;
   Additional notes (optional): 
   xxx;`
      },
      detailed: {
        rule3: '3. Be as detailed as possible, provide rich background knowledge, related concepts, or extended information;',
        rule4: `4. Output in the following format with detailed supplementary information:
   Base meaning: 
   xxx;
   Contextual meaning: 
   xxx;
   Extended information: 
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
7. Do not use code blocks, inline code, or HTML tags (e.g., \`\`\` or \`code\` or <tag>, except source_lang tag);
8. When the input contains a <image_content> tag, it means the user selected text from an image via OCR. Prioritize recognizing, translating, and explaining the image text content as the primary subject of analysis`;
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
