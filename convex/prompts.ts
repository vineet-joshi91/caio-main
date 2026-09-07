import type { Doc } from './_generated/dataModel'

export function formatBusinessMemory(
  profile: Doc<'businessProfiles'> | null,
  facts: Array<Doc<'memoryFacts'>>,
) {
  const lines: Array<string> = []

  if (profile) {
    if (profile.summary) lines.push(`Summary: ${profile.summary}`)
    if (profile.industry) lines.push(`Industry: ${profile.industry}`)
    if (profile.businessModel) lines.push(`Business model: ${profile.businessModel}`)
    if (profile.targetCustomers) lines.push(`Target customers: ${profile.targetCustomers}`)
    if (profile.goals.length) lines.push(`Goals: ${profile.goals.join('; ')}`)
    if (profile.constraints.length) lines.push(`Constraints: ${profile.constraints.join('; ')}`)
  }

  for (const fact of facts) {
    lines.push(`[${fact.type}] ${fact.fact}`)
  }

  return lines.join('\n')
}

export function advisorSystemPrompt(context: {
  workspaceName: string
  businessMemory: string
  corpusContext?: string
  hasTools: boolean
}) {
  const toolRules = context.hasTools
    ? [
        '- Use the searchDocuments tool to retrieve additional company context before answering substantive questions about the business. Cite which documents informed your answer.',
        '- When the user states a durable fact, decision, goal, assumption, or preference about the business, record it with the saveMemoryFact tool (be conservative; only clear, lasting facts).',
      ]
    : [
        '- Ground your answers in the "Retrieved document context" below and name the documents you relied on.',
      ]

  return [
    `You are CAIO, an AI Chief Intelligence Officer for ${context.workspaceName}.`,
    'You advise on strategy, operations, finance, and growth, grounded in the company\'s uploaded documents.',
    '',
    'Rules:',
    ...toolRules,
    '- If context is insufficient, say what is missing and ask for the document or detail needed.',
    '- Label general reasoning that is not grounded in company documents as such.',
    '- Be direct and practical. Prefer concrete recommendations over generic advice.',
    '',
    'Business memory:',
    context.businessMemory || 'No structured business memory has been recorded yet.',
    '',
    'Retrieved document context:',
    context.corpusContext || 'No relevant document context was retrieved for this message.',
  ].join('\n')
}

// Every generated report must contain exactly these factors, in this order.
// Revenue is the common factor deliberately present in all reports.
export const REQUIRED_AUDIT_SECTIONS = [
  'Revenue',
  'Strategy',
  'Finances',
  'Operations',
  'Marketing & Sales',
  'Product',
  'Risk',
] as const

export function auditInstructions(workspaceName: string) {
  return [
    `Run a rigorous business audit for ${workspaceName}.`,
    `Score the company overall (0-100) and per section (0-100). sectionScores MUST contain exactly these sections, in this order: ${REQUIRED_AUDIT_SECTIONS.join(', ')}.`,
    'The Revenue section is mandatory in every report: assess revenue model, current revenue, growth trajectory, and concentration risk.',
    'Base every finding on the supplied documents and business memory; cite the source documents.',
    'If the corpus lacks evidence for a section, score it conservatively and say what documents are missing in the rationale.',
    'Be specific: name numbers, dates, and documents rather than generic observations.',
    'In consultingNeed, write 2-4 sentences on where hands-on expert consulting would most improve this business right now, grounded in the weakest findings. Address the reader directly.',
  ].join('\n')
}
